import { Queue } from 'bullmq';
import { getRedis } from '../../lib/redis';
import { logger } from '../../lib/logger';

// Queue names
export const QUEUE_NAMES = {
  DICOM_PROCESS: 'dicom-process',
  STORESCU: 'storescu',
  WEBHOOK_RETRY: 'webhook-retry',
} as const;

let dicomProcessQueue: Queue | null = null;
let storescuQueue: Queue | null = null;
let webhookRetryQueue: Queue | null = null;

function createQueue(name: string): Queue {
  const connection = getRedis();
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  queue.on('error', (err) => {
    logger.error({ err, queue: name }, `Queue error: ${name}`);
  });

  return queue;
}

export function getDicomProcessQueue(): Queue {
  if (!dicomProcessQueue) {
    dicomProcessQueue = createQueue(QUEUE_NAMES.DICOM_PROCESS);
  }
  return dicomProcessQueue;
}

export function getStorescuQueue(): Queue {
  if (!storescuQueue) {
    storescuQueue = createQueue(QUEUE_NAMES.STORESCU);
  }
  return storescuQueue;
}

export function getWebhookRetryQueue(): Queue {
  if (!webhookRetryQueue) {
    webhookRetryQueue = createQueue(QUEUE_NAMES.WEBHOOK_RETRY);
  }
  return webhookRetryQueue;
}

export async function closeQueues(): Promise<void> {
  const queues = [dicomProcessQueue, storescuQueue, webhookRetryQueue];
  for (const q of queues) {
    if (q) await q.close();
  }
}
