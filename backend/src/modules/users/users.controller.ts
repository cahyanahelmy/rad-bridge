import { FastifyRequest, FastifyReply } from 'fastify';
import { usersService } from './users.service';

export class UsersController {
  async list(req: FastifyRequest, rep: FastifyReply) {
    const users = await usersService.getAll();
    return rep.send({ success: true, data: users });
  }

  async get(req: FastifyRequest, rep: FastifyReply) {
    const { id } = req.params as { id: string };
    const user = await usersService.getById(id);
    return rep.send({ success: true, data: user });
  }

  async create(req: FastifyRequest, rep: FastifyReply) {
    const user = await usersService.create(req.body as any);
    return rep.status(201).send({ success: true, data: user });
  }

  async update(req: FastifyRequest, rep: FastifyReply) {
    const { id } = req.params as { id: string };
    const user = await usersService.update(id, req.body as any);
    return rep.send({ success: true, data: user });
  }

  async resetPassword(req: FastifyRequest, rep: FastifyReply) {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password: string };
    const result = await usersService.resetPassword(id, password);
    return rep.send({ success: true, data: result });
  }
}

export const usersController = new UsersController();
