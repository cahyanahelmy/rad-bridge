import { Worker, Job } from 'bullmq';
import { getRedis } from '../../../lib/redis';
import { logger } from '../../../lib/logger';
import { prisma } from '../../../lib/prisma';
import { QUEUE_NAMES } from '../queue';
import { config } from '../../../config';
import { satusehatClient } from '../../satusehat/satusehat.client';

export interface WebhookRetryJob {
  orderId: string;
  accessionNumber: string;
}

export function startWebhookRetryWorker(): Worker {
  const worker = new Worker<WebhookRetryJob>(
    QUEUE_NAMES.WEBHOOK_RETRY,
    async (job: Job<WebhookRetryJob>) => {
      const { orderId, accessionNumber } = job.data;

      logger.info({ accessionNumber, jobId: job.id }, 'Querying ImagingStudy fallback');

      // Query SATUSEHAT for ImagingStudy by accession number
      const response = await satusehatClient.searchImagingStudy(
        accessionNumber,
        config.satusehat.orgId
      );

      // Check if ImagingStudy was found
      const bundle = response as any;
      if (bundle.total && bundle.total > 0 && bundle.entry?.length > 0) {
        const imagingStudy = bundle.entry[0].resource;
        const imagingstudyId = imagingStudy.id;

        // Update order
        await prisma.radiologyOrder.update({
          where: { id: orderId },
          data: {
            imagingstudyId,
            status: 'IMAGING_CREATED',
          },
        });

        logger.info({ accessionNumber, imagingstudyId }, '✓ ImagingStudy found via fallback query');
        return { imagingstudyId };
      }

      // If not found, throw to retry
      throw new Error(`ImagingStudy not yet available for accession ${accessionNumber}`);
    },
    {
      connection: getRedis(),
      concurrency: 2,
    }
  );

  worker.on('failed', async (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, 'Webhook retry job failed');

    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await prisma.failedJob.create({
        data: {
          queueName: QUEUE_NAMES.WEBHOOK_RETRY,
          jobId: job.id || 'unknown',
          jobName: job.name,
          payload: JSON.stringify(job.data),
          error: err.message,
          attempts: job.attemptsMade,
        },
      });
    }
  });

  logger.info('✓ Webhook retry worker started');
  return worker;
}
