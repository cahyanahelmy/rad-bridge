import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { AuthenticationError } from '../../lib/errors';
import type { JwtPayload, UserRole } from '../../types';

export class AuthService {
  /**
   * Authenticate user with username/password.
   * Returns access token + refresh token.
   */
  async login(username: string, password: string, userAgent?: string, ip?: string) {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      throw new AuthenticationError('Invalid username or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid username or password');
    }

    // Generate tokens
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refreshToken = uuidv4();

    // Parse refresh expiry
    const refreshExpiresMs = this.parseExpiry(config.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + refreshExpiresMs);

    // Save session
    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent,
        ipAddress: ip,
        expiresAt,
      },
    });

    logger.info({ userId: user.id, username: user.username }, 'User logged in');

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refresh(refreshToken: string) {
    const session = await prisma.userSession.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    if (!session.user.active) {
      throw new AuthenticationError('User account is deactivated');
    }

    const payload: JwtPayload = {
      userId: session.user.id,
      username: session.user.username,
      role: session.user.role as UserRole,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    return {
      accessToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  /**
   * Logout: delete session.
   */
  async logout(refreshToken: string) {
    await prisma.userSession.deleteMany({
      where: { refreshToken },
    });
  }

  /**
   * Verify JWT token and return payload.
   */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (err) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }
}

export const authService = new AuthService();
