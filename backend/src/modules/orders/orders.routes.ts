import { FastifyInstance } from 'fastify';
import { ordersController } from './orders.controller';
import { authenticate } from '../auth/auth.middleware';

export async function ordersRoutes(app: FastifyInstance) {
  // All orders routes require authentication
  app.addHook('preHandler', authenticate);

  // POST /api/orders — Create radiology order
  app.post('/', (req, rep) => ordersController.create(req, rep));

  // GET /api/orders — List orders (with optional ?status=WAITING_UPLOAD&page=1&limit=20)
  app.get('/', (req, rep) => ordersController.list(req, rep));

  // GET /api/orders/:id — Get single order
  app.get('/:id', (req, rep) => ordersController.get(req, rep));
}
