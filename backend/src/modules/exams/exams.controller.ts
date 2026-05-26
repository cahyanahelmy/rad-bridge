import { FastifyRequest, FastifyReply } from 'fastify';
import { examsService } from './exams.service';

export class ExamsController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { all } = request.query as { all?: string };
    const exams = await examsService.getAll(all !== 'true');
    return reply.send({ success: true, data: exams });
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.params as { code: string };
    const exam = await examsService.getByCode(code);
    return reply.send({ success: true, data: exam });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const exam = await examsService.create(request.body as any);
    return reply.status(201).send({ success: true, data: exam });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.params as { code: string };
    const exam = await examsService.update(code, request.body as any);
    return reply.send({ success: true, data: exam });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.params as { code: string };
    const exam = await examsService.delete(code);
    return reply.send({ success: true, message: 'Pemeriksaan berhasil dihapus.', data: exam });
  }
}

export const examsController = new ExamsController();
