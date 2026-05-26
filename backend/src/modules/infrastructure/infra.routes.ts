import { FastifyInstance } from 'fastify';
import { infraController } from './infra.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

export async function infraRoutes(app: FastifyInstance) {
  // Public endpoint
  app.get('/status', (req, rep) => infraController.status(req, rep));

  // Protected endpoints
  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', authenticate);

    protectedApp.get('/logs', (req, rep) => infraController.logs(req, rep));

    // Admin-only actions
    protectedApp.post('/start', { preHandler: [authorize('ADMIN' as any)] }, (req, rep) => infraController.start(req, rep));
    protectedApp.post('/stop', { preHandler: [authorize('ADMIN' as any)] }, (req, rep) => infraController.stop(req, rep));
    protectedApp.post('/restart', { preHandler: [authorize('ADMIN' as any)] }, (req, rep) => infraController.restart(req, rep));
  });
}
