import { Worker, Job } from 'bullmq';
import { getRedis } from '../../../lib/redis';
import { logger } from '../../../lib/logger';
import { prisma } from '../../../lib/prisma';
import { QUEUE_NAMES } from '../queue';
import { dicomService } from '../../../modules/dicom/dicom.service';
import { cleanupStudy } from '../../storage/storage-manager';

export interface DicomProcessJob {
  orderId: string;
  dicomFileId: string;
  accessionNumber: string;
  originalPath: string;
  studyDescription: string;
  patientId: string;
}

export function startDicomProcessWorker(): Worker {
  const worker = new Worker<DicomProcessJob>(
    QUEUE_NAMES.DICOM_PROCESS,
    async (job: Job<DicomProcessJob>) => {
      const { orderId, dicomFileId, accessionNumber, originalPath, studyDescription, patientId } = job.data;

      logger.info({ accessionNumber, jobId: job.id }, 'Processing DICOM file');

      // 1. Copy and inject metadata
      const result = await dicomService.processFile({
        originalPath,
        accessionNumber,
        studyDescription,
        patientId,
      });

      if (!result.success) {
        throw new Error(`DICOM processing failed: ${result.error}`);
      }

      // 2. Update dicom_files record
      await prisma.dicomFile.update({
        where: { id: dicomFileId },
        data: {
          processedPath: result.processedPath,
          processed: true,
        },
      });

      // 3. Update order status
      await prisma.radiologyOrder.update({
        where: { id: orderId },
        data: { status: 'DICOM_RECEIVED' },
      });

      logger.info({ accessionNumber }, '✓ DICOM file processed');

      return { processedPath: result.processedPath };
    },
    {
      connection: getRedis(),
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'DICOM process job completed');
  });

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, err }, 'DICOM process job failed');

    if (job) {
      // Log failed job
      await prisma.failedJob.create({
        data: {
          queueName: QUEUE_NAMES.DICOM_PROCESS,
          jobId: job.id || 'unknown',
          jobName: job.name,
          payload: JSON.stringify(job.data),
          error: err.message,
          attempts: job.attemptsMade,
        },
      });

      // Update order status if max retries exceeded
      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        await prisma.radiologyOrder.update({
          where: { id: job.data.orderId },
          data: {
            status: 'FAILED',
            lastError: `DICOM processing failed after ${job.attemptsMade} attempts: ${err.message}`,
          },
        });
        
        // Clean up physical DICOM files on failure
        await cleanupStudy(job.data.accessionNumber, 'MAX_RETRY_EXCEEDED');
      }
    }
  });

  logger.info('✓ DICOM process worker started');
  return worker;
}
