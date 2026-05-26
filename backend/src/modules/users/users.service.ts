import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';

export class UsersService {
  async getAll() {
    return prisma.user.findMany({
      select: { id: true, username: true, fullName: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, fullName: true, role: true, active: true, createdAt: true },
    });
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async create(data: { username: string; password: string; fullName: string; role: string }) {
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing) throw new ConflictError(`Username '${data.username}' already exists`);

    const passwordHash = await bcrypt.hash(data.password, 12);
    return prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        fullName: data.fullName,
        role: data.role as any,
      },
      select: { id: true, username: true, fullName: true, role: true, active: true, createdAt: true },
    });
  }

  async update(id: string, data: { fullName?: string; role?: string; active?: boolean }) {
    await this.getById(id);
    return prisma.user.update({
      where: { id },
      data: data as any,
      select: { id: true, username: true, fullName: true, role: true, active: true, createdAt: true },
    });
  }

  async resetPassword(id: string, newPassword: string) {
    await this.getById(id);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    return { message: 'Password reset successfully' };
  }
}

export const usersService = new UsersService();
