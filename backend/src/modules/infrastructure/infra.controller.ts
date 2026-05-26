import { FastifyRequest, FastifyReply } from 'fastify';
import { infraService } from './infra.service';

export class InfraController {
  async status(req: FastifyRequest, rep: FastifyReply) {
    const [routerStatus, runtimeInfo] = await Promise.all([
      infraService.getRouterStatus(),
      infraService.checkRuntime(),
    ]);
    return rep.send({ success: true, data: { router: routerStatus, runtime: runtimeInfo } });
  }

  async start(req: FastifyRequest, rep: FastifyReply) {
    const result = await infraService.startRouter();
    return rep.send({ success: true, data: result });
  }

  async stop(req: FastifyRequest, rep: FastifyReply) {
    const result = await infraService.stopRouter();
    return rep.send({ success: true, data: result });
  }

  async restart(req: FastifyRequest, rep: FastifyReply) {
    const result = await infraService.restartRouter();
    return rep.send({ success: true, data: result });
  }

  async logs(req: FastifyRequest, rep: FastifyReply) {
    const { tail } = req.query as { tail?: string };
    const logs = await infraService.getRouterLogs(tail ? parseInt(tail) : undefined);
    return rep.send({ success: true, data: { logs } });
  }
}

export const infraController = new InfraController();
