import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';
import { infraService } from '../modules/infrastructure/infra.service';
import { startDicomProcessWorker } from '../services/queue/workers/dicom-process.worker';
import { startStoreScuWorker } from '../services/queue/workers/storescu.worker';
import { startWebhookRetryWorker } from '../services/queue/workers/webhook-retry.worker';

/**
 * Bootstrap orchestrator.
 * Runs startup checks and initializations in sequence.
 */
export async function bootstrap(): Promise<void> {
  logger.info('Starting bootstrap sequence...\n');

  // 1. Validate configuration
  logger.info('  [1/8] Validating configuration...');
  validateConfig();
  logger.info('  ✓ Configuration valid\n');

  // 2. Create storage directories & config
  logger.info('  [2/8] Creating storage directories & config...');
  await createStorageDirectories();
  await generateRouterConfig();
  logger.info('  ✓ Storage directories and router config ready\n');

  // 3. Check PostgreSQL
  logger.info('  [3/8] Checking PostgreSQL...');
  await checkDatabase();
  logger.info('  ✓ PostgreSQL connected\n');

  // 4. Check Redis
  logger.info('  [4/8] Checking Redis...');
  await checkRedis();
  logger.info('  ✓ Redis connected\n');

  // 5. Check container runtime
  logger.info('  [5/8] Checking container runtime...');
  const runtimeResult = await infraService.checkRuntime();
  if (runtimeResult.available) {
    logger.info(`  ✓ ${config.container.runtime} available: ${runtimeResult.version}\n`);
  } else {
    logger.warn(`  ⚠ ${config.container.runtime} not available (DICOM Router management disabled)\n`);
  }

  // 6. Auto-start DICOM Router (best-effort)
  logger.info('  [6/8] Starting DICOM Router...');
  if (runtimeResult.available) {
    const routerStatus = await infraService.getRouterStatus();
    if (routerStatus.status !== 'running') {
      const startResult = await infraService.startRouter();
      if (startResult.success) {
        logger.info('  ✓ DICOM Router started\n');
      } else {
        logger.warn(`  ⚠ DICOM Router start failed: ${startResult.error}\n`);
      }
    } else {
      logger.info('  ✓ DICOM Router already running\n');
    }
  } else {
    logger.warn('  ⚠ Skipped (no container runtime)\n');
  }

  // 7. Check SATUSEHAT connectivity (best-effort)
  logger.info('  [7/8] Checking SATUSEHAT connectivity...');
  if (config.satusehat.clientKey && config.satusehat.secretKey) {
    try {
      const { satusehatClient } = await import('../services/satusehat/satusehat.client');
      const isHealthy = await satusehatClient.healthCheck();
      if (isHealthy) {
        logger.info('  ✓ SATUSEHAT connected\n');
      } else {
        logger.warn('  ⚠ SATUSEHAT connection failed\n');
      }
    } catch (err: any) {
      logger.warn(`  ⚠ SATUSEHAT check skipped: ${err.message}\n`);
    }
  } else {
    logger.warn('  ⚠ SATUSEHAT credentials not configured\n');
  }

  // 8. Start BullMQ workers
  logger.info('  [8/8] Starting queue workers...');
  startDicomProcessWorker();
  startStoreScuWorker();
  startWebhookRetryWorker();
  logger.info('  ✓ Queue workers started\n');

  logger.info('Bootstrap sequence complete!\n');
}

function validateConfig(): void {
  const required = [
    ['DATABASE_URL', config.database.url],
    ['JWT_SECRET', config.jwt.secret],
  ];

  for (const [name, value] of required) {
    if (!value) {
      throw new Error(`Missing required configuration: ${name}`);
    }
  }

  if (config.jwt.secret === 'change-this-to-a-strong-secret-key') {
    logger.warn('⚠ JWT_SECRET is using default value. Change this in production!');
  }
}

async function createStorageDirectories(): Promise<void> {
  const basePath = path.resolve(config.storage.basePath);
  await fs.mkdir(basePath, { recursive: true });
  await fs.mkdir(path.join(basePath, 'dicom', 'incoming'), { recursive: true });
  const logsPath = path.resolve(__dirname, '../../../logs/dicom-router');
  await fs.mkdir(logsPath, { recursive: true });
}

async function generateRouterConfig(): Promise<void> {
  const routerConfPath = path.resolve(__dirname, '../../../router.conf');
  const confContent = `[satusehat]
url = ${config.satusehat.baseUrl}
mroc_client_url = ${config.satusehat.baseUrl}

dicom_pathsuffix = ${config.dicomRouter.pathSuffixDicom}
fhir_pathsuffix = ${config.dicomRouter.pathSuffixFhir}

tz_name = ${config.dicomRouter.tz}

ae_title = ${config.dicomRouter.aeTitle}
calling_ae_title = ${config.dicomRouter.aeTitle}

dicom_port = ${config.dicomRouter.port}
http_port = ${config.dicomRouter.httpPort}

dcm_dir = /in/

webhook_url = ${config.webhook.callbackUrl}
webhook_user = ${config.webhook.username}
webhook_password = ${config.webhook.password}

organization_id = ${config.satusehat.orgId}
client_key = ${config.satusehat.clientKey}
secret_key = ${config.satusehat.secretKey}
`;

  await fs.writeFile(routerConfPath, confContent, 'utf-8');
  logger.info('  ✓ router.conf generated dynamically');
}

async function checkDatabase(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    throw new Error(`PostgreSQL connection failed: ${err.message}\n  Check DATABASE_URL in .env`);
  }
}

async function checkRedis(): Promise<void> {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('Unexpected ping response');
  } catch (err: any) {
    throw new Error(`Redis connection failed: ${err.message}\n  Check REDIS_HOST and REDIS_PORT in .env`);
  }
}
