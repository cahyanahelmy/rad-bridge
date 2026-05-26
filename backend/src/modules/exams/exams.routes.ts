import { FastifyInstance } from 'fastify';
import { examsController } from './exams.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

export async function examsRoutes(app: FastifyInstance) {
  // GET /api/exams — public for SIMRS integration (no auth required)
  app.get('/', (req, rep) => examsController.list(req, rep));

  // GET /api/exams/:code
  app.get('/:code', (req, rep) => examsController.get(req, rep));

  // POST /api/exams — Admin only
  app.post('/', { preHandler: [authenticate, authorize('ADMIN' as any)] }, (req, rep) => examsController.create(req, rep));

  // PUT /api/exams/:code — Admin only
  app.put('/:code', { preHandler: [authenticate, authorize('ADMIN' as any)] }, (req, rep) => examsController.update(req, rep));

  // DELETE /api/exams/:code — Admin only
  app.delete('/:code', { preHandler: [authenticate, authorize('ADMIN' as any)] }, (req, rep) => examsController.delete(req, rep));
}
