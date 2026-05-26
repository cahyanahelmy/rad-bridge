import { FastifyInstance } from 'fastify';
import { usersController } from './users.controller';
import { authenticate, authorize } from '../auth/auth.middleware';

export async function usersRoutes(app: FastifyInstance) {
  // All user management routes require ADMIN role
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', authorize('ADMIN' as any));

  app.get('/', (req, rep) => usersController.list(req, rep));
  app.get('/:id', (req, rep) => usersController.get(req, rep));
  app.post('/', (req, rep) => usersController.create(req, rep));
  app.put('/:id', (req, rep) => usersController.update(req, rep));
  app.post('/:id/reset-password', (req, rep) => usersController.resetPassword(req, rep));
}
