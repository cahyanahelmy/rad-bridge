import { FastifyRequest, FastifyReply } from 'fastify';
import { monitoringService } from './monitoring.service';

export class MonitoringController {
  async dashboard(request: FastifyRequest, reply: FastifyReply) {
    const stats = await monitoringService.getDashboardStats();
    return reply.send({ success: true, data: stats });
  }

  async queues(request: FastifyRequest, reply: FastifyReply) {
    const stats = await monitoringService.getQueueStats();
    return reply.send({ success: true, data: stats });
  }

  async connectivity(request: FastifyRequest, reply: FastifyReply) {
    const checks = await monitoringService.getConnectivity();
    return reply.send({ success: true, data: checks });
  }

  async webhookLogs(request: FastifyRequest, reply: FastifyReply) {
    const { limit } = request.query as any;
    const logs = await monitoringService.getWebhookLogs(limit ? parseInt(limit) : undefined);
    return reply.send({ success: true, data: logs });
  }

  async failedJobs(request: FastifyRequest, reply: FastifyReply) {
    const { limit } = request.query as any;
    const jobs = await monitoringService.getFailedJobs(limit ? parseInt(limit) : undefined);
    return reply.send({ success: true, data: jobs });
  }

  async storage(request: FastifyRequest, reply: FastifyReply) {
    const stats = await monitoringService.getStorageStats();
    return reply.send({ success: true, data: stats });
  }
}

export const monitoringController = new MonitoringController();
