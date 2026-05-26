import { FastifyInstance } from 'fastify';
import { webhookController } from './webhook.controller';
import { config } from '../../config';
import crypto from 'crypto';

export async function webhookRoutes(app: FastifyInstance) {
  // HTTP Basic Auth for DICOM Router webhook
  app.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      reply.status(401).header('WWW-Authenticate', 'Basic').send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Basic authentication required' },
      });
      return;
    }

    const base64 = authHeader.substring(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    // Use timing-safe comparison to prevent timing attacks
    const expectedUser = config.webhook.username;
    const expectedPass = config.webhook.password;
    const userBuf = Buffer.from(username || '');
    const passBuf = Buffer.from(password || '');
    const expectedUserBuf = Buffer.from(expectedUser);
    const expectedPassBuf = Buffer.from(expectedPass);

    const userMatch = userBuf.length === expectedUserBuf.length &&
      crypto.timingSafeEqual(userBuf, expectedUserBuf);
    const passMatch = passBuf.length === expectedPassBuf.length &&
      crypto.timingSafeEqual(passBuf, expectedPassBuf);

    if (!userMatch || !passMatch) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
      return;
    }
  });

  // POST /api/dicom-router/callback
  app.post('/callback', (req, rep) => webhookController.callback(req, rep));
}
