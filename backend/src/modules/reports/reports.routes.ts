import { FastifyInstance } from 'fastify';
import { reportsController } from './reports.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // POST /api/reports — Create DiagnosticReport (Radiologist only)
  app.post('/', { preHandler: [authorize('RADIOLOGIST' as any, 'ADMIN' as any)] }, (req, rep) => reportsController.create(req, rep));

  // GET /api/reports — List reports
  app.get('/', (req, rep) => reportsController.list(req, rep));
}
