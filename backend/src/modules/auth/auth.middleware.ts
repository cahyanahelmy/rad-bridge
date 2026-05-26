import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';
import { AuthenticationError, AuthorizationError } from '../../lib/errors';
import type { UserRole } from '../../types';

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token, attaches user to request.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7);
  const payload = authService.verifyToken(token);

  (request as any).user = payload;
}

/**
 * Role-based access control middleware factory.
 * Usage: { preHandler: [authenticate, authorize('ADMIN', 'RADIOLOGIST')] }
 */
export function authorize(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!roles.includes(user.role)) {
      throw new AuthorizationError(
        `Role '${user.role}' does not have access to this resource. Required: ${roles.join(', ')}`
      );
    }
  };
}
