import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import { AppError } from './lib/errors';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { ordersRoutes } from './modules/orders/orders.routes';
import { examsRoutes } from './modules/exams/exams.routes';
import { uploadRoutes } from './modules/upload/upload.routes';
import { webhookRoutes } from './modules/webhook/webhook.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { monitoringRoutes } from './modules/monitoring/monitoring.routes';
import { infraRoutes } from './modules/infrastructure/infra.routes';
import { usersRoutes } from './modules/users/users.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use our own pino logger
    bodyLimit: 100 * 1024 * 1024, // 100MB for DICOM files
  });

  // --- Plugins ---
  await app.register(cors, {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      // Add production frontend URL here when deployed
    ],
    credentials: true,
  });

  // Rate limiting — protect against brute-force attacks
  await app.register(rateLimit, {
    global: false, // Not global — applied per-route below
  });

  await app.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB max DICOM file
      files: 10,
    },
  });

  // --- Global error handler ---
  app.setErrorHandler((error: any, request, reply) => {
    if (error instanceof AppError) {
      logger.warn({
        code: error.code,
        message: error.message,
        path: request.url,
        method: request.method,
      }, `AppError: ${error.message}`);

      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    // Unexpected errors
    logger.error({ err: error, path: request.url }, 'Unhandled error');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: config.app.env === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      },
    });
  });

  // --- Health check ---
  app.get('/api/health', async () => ({
    success: true,
    data: {
      service: config.app.name,
      version: config.app.version,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  }));

  // --- Register routes ---
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(ordersRoutes, { prefix: '/api/orders' });
  await app.register(examsRoutes, { prefix: '/api/exams' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(webhookRoutes, { prefix: '/api/dicom-router' });
  await app.register(reportsRoutes, { prefix: '/api/reports' });
  await app.register(monitoringRoutes, { prefix: '/api/monitoring' });
  await app.register(infraRoutes, { prefix: '/api/infrastructure' });
  await app.register(usersRoutes, { prefix: '/api/users' });

  return app;
}
