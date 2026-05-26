// Fix BigInt JSON serialization for Prisma
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { config } from './config';
import { logger } from './lib/logger';
import { buildApp } from './app';
import { bootstrap } from './bootstrap';
import { closeRedis } from './lib/redis';
import { prisma } from './lib/prisma';

async function main() {
  logger.info('='.repeat(60));
  logger.info(`  ${config.app.name} v${config.app.version}`);
  logger.info(`  SATUSEHAT Imaging Interoperability Platform`);
  logger.info('='.repeat(60));

  // --- Bootstrap: health checks & startup ---
  await bootstrap();

  // --- Build Fastify app ---
  const app = await buildApp();

  // --- Start server ---
  try {
    await app.listen({
      host: config.server.host,
      port: config.server.port,
    });
    logger.info(`✓ Server listening on http://${config.server.host}:${config.server.port}`);
    logger.info('='.repeat(60));
    logger.info('  RIS Bridge is ready');
    logger.info('='.repeat(60));
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await app.close();
      await prisma.$disconnect();
      await closeRedis();
      logger.info('✓ Shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
