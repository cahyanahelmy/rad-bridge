import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';
import { logger } from '../../lib/logger';

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const { username, password } = request.body as { username: string; password: string };

    const result = await authService.login(
      username,
      password,
      request.headers['user-agent'],
      request.ip
    );

    return reply.send({
      success: true,
      data: result,
    });
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = request.body as { refreshToken: string };

    const result = await authService.refresh(refreshToken);

    return reply.send({
      success: true,
      data: result,
    });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = request.body as { refreshToken: string };

    await authService.logout(refreshToken);

    return reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user;

    return reply.send({
      success: true,
      data: {
        userId: user.userId,
        username: user.username,
        role: user.role,
      },
    });
  }
}

export const authController = new AuthController();
