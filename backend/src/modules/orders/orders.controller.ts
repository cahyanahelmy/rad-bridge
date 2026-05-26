import { FastifyRequest, FastifyReply } from 'fastify';
import { ordersService } from './orders.service';

export class OrdersController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.body as any;
    const result = await ordersService.createOrder(payload);

    return reply.status(201).send({
      success: true,
      data: result,
    });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const { status, search, page, limit } = request.query as any;
    const result = await ordersService.getOrders({
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return reply.send({
      success: true,
      data: result.data,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await ordersService.getOrder(id);

    return reply.send({
      success: true,
      data: result,
    });
  }
}

export const ordersController = new OrdersController();
