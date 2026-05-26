import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError } from '../../lib/errors';

export class ExamsService {
  async getAll(activeOnly: boolean = true) {
    return prisma.radiologyExamMaster.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { examCode: 'asc' },
    });
  }

  async getByCode(examCode: string) {
    const exam = await prisma.radiologyExamMaster.findUnique({
      where: { examCode },
    });
    if (!exam) throw new NotFoundError('RadiologyExamMaster', examCode);
    return exam;
  }

  async create(data: any) {
    // Check if code already exists to throw clean ConflictError
    const existing = await prisma.radiologyExamMaster.findUnique({
      where: { examCode: data.examCode },
    });
    if (existing) {
      throw new ConflictError(`Kode pemeriksaan '${data.examCode}' sudah terdaftar.`);
    }
    return prisma.radiologyExamMaster.create({ data });
  }

  async update(examCode: string, data: any) {
    await this.getByCode(examCode);
    return prisma.radiologyExamMaster.update({
      where: { examCode },
      data,
    });
  }

  async toggleActive(examCode: string) {
    const exam = await this.getByCode(examCode);
    return prisma.radiologyExamMaster.update({
      where: { examCode },
      data: { active: !exam.active },
    });
  }

  async delete(examCode: string) {
    await this.getByCode(examCode);
    
    // Check if there are orders referencing this examCode
    const orderCount = await prisma.radiologyOrder.count({
      where: { examCode },
    });
    
    if (orderCount > 0) {
      throw new ConflictError(`Tidak dapat menghapus pemeriksaan karena sudah memiliki ${orderCount} order aktif. Silakan nonaktifkan saja.`);
    }
    
    return prisma.radiologyExamMaster.delete({
      where: { examCode },
    });
  }
}

export const examsService = new ExamsService();
