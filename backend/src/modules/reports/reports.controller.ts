import { FastifyRequest, FastifyReply } from 'fastify';
import { reportsService } from './reports.service';

export class ReportsController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;
    const body = request.body as any;

    const result = await reportsService.createReport({
      orderId: body.orderId,
      radiologistId: user.userId,
      observation: body.observation,
      diagnosticReport: body.diagnosticReport,
    });

    return reply.status(201).send({ success: true, data: result });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const { page, limit } = request.query as any;
    const result = await reportsService.getReports({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return reply.send({
      success: true,
      data: result.data,
      meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  }
}

export const reportsController = new ReportsController();
