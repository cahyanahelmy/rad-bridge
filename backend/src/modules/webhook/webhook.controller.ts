import { FastifyRequest, FastifyReply } from 'fastify';
import { webhookService } from './webhook.service';

export class WebhookController {
  async callback(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.body;
    const result = await webhookService.handleCallback(payload);
    return reply.send({ success: true, data: result });
  }
}

export const webhookController = new WebhookController();
