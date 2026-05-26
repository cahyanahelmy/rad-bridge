import { Worker, Job } from 'bullmq';
import { getRedis } from '../../../lib/redis';
import { logger } from '../../../lib/logger';
import { prisma } from '../../../lib/prisma';
import { QUEUE_NAMES } from '../queue';
import { dicomService } from '../../../modules/dicom/dicom.service';
import { cleanupStudy } from '../../storage/storage-manager';
import { ordersService } from '../../../modules/orders/orders.service';

export interface StoreScuJob {
  orderId: string;
  dicomFileId: string;
  accessionNumber: string;
  processedPath: string;
}

export function startStoreScuWorker(): Worker {
  const worker = new Worker<StoreScuJob>(
    QUEUE_NAMES.STORESCU,
    async (job: Job<StoreScuJob>) => {
      const { orderId, dicomFileId, accessionNumber, processedPath } = job.data;

      logger.info({ accessionNumber, jobId: job.id }, 'Executing storescu');

      // Ensure ServiceRequest resource is created in SATUSEHAT first
      await ordersService.ensureServiceRequest(orderId);

      const result = await dicomService.sendToRouter(processedPath);

      if (!result.success) {
        throw new Error(`storescu failed (exit code ${result.exitCode}): ${result.stderr}`);
      }

      // Update dicom file as sent
      await prisma.dicomFile.update({
        where: { id: dicomFileId },
        data: { sentToRouter: true },
      });

      logger.info({ accessionNumber }, '✓ DICOM sent to router via storescu');

      return { exitCode: result.exitCode };
    },
    {
      connection: getRedis(),
      concurrency: 1, // Sequential storescu execution
    }
  );

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err }, 'storescu job failed');

    if (job) {
      await prisma.failedJob.create({
        data: {
          queueName: QUEUE_NAMES.STORESCU,
          jobId: job.id || 'unknown',
          jobName: job.name,
          payload: JSON.stringify(job.data),
          error: err.message,
          attempts: job.attemptsMade,
        },
      });

      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        await prisma.radiologyOrder.update({
          where: { id: job.data.orderId },
          data: {
            status: 'FAILED',
            lastError: `storescu failed after ${job.attemptsMade} attempts: ${err.message}`,
          },
        });
        
        // Clean up physical DICOM files on failure
        await cleanupStudy(job.data.accessionNumber, 'MAX_RETRY_EXCEEDED');
      }
    }
  });

  logger.info('✓ storescu worker started');
  return worker;
}
