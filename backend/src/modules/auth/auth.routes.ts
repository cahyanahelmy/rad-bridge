import { FastifyInstance } from 'fastify';
import { authController } from './auth.controller';
import { authenticate } from './auth.middleware';

export async function authRoutes(app: FastifyInstance) {
  // Rate limit config for auth endpoints (brute-force protection)
  const authRateLimit = {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  };

  // POST /api/auth/login (rate-limited: 5 req/min per IP)
  app.post('/login', authRateLimit, (req, rep) => authController.login(req, rep));

  // POST /api/auth/refresh (rate-limited: 5 req/min per IP)
  app.post('/refresh', authRateLimit, (req, rep) => authController.refresh(req, rep));

  // POST /api/auth/logout
  app.post('/logout', (req, rep) => authController.logout(req, rep));

  // GET /api/auth/me (protected)
  app.get('/me', { preHandler: [authenticate] }, (req, rep) => authController.me(req, rep));
}
