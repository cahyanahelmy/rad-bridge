import { FastifyInstance } from 'fastify';
import { monitoringController } from './monitoring.controller';
import { authenticate } from '../auth/auth.middleware';

export async function monitoringRoutes(app: FastifyInstance) {
  // Public endpoint
  app.get('/connectivity', (req, rep) => monitoringController.connectivity(req, rep));

  // Protected endpoints
  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', authenticate);
    
    protectedApp.get('/dashboard', (req, rep) => monitoringController.dashboard(req, rep));
    protectedApp.get('/queues', (req, rep) => monitoringController.queues(req, rep));
    protectedApp.get('/webhooks', (req, rep) => monitoringController.webhookLogs(req, rep));
    protectedApp.get('/failed-jobs', (req, rep) => monitoringController.failedJobs(req, rep));
    protectedApp.get('/storage', (req, rep) => monitoringController.storage(req, rep));
  });
}
