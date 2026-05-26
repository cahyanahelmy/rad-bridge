import { prisma } from '../../lib/prisma';
import { getRedis } from '../../lib/redis';
import { satusehatClient } from '../../services/satusehat/satusehat.client';
import { getDicomProcessQueue, getStorescuQueue, getWebhookRetryQueue } from '../../services/queue/queue';
import { logger } from '../../lib/logger';
import { config } from '../../config';

export class MonitoringService {
  /**
   * Get comprehensive dashboard stats.
   */
  async getDashboardStats() {
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      failedOrders,
      totalReports,
      recentOrders,
    ] = await Promise.all([
      prisma.radiologyOrder.count(),
      prisma.radiologyOrder.count({ where: { status: 'WAITING_UPLOAD' } }),
      prisma.radiologyOrder.count({ where: { status: 'REPORT_CREATED' } }),
      prisma.radiologyOrder.count({ where: { status: 'FAILED' } }),
      prisma.diagnosticReport.count(),
      prisma.radiologyOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { exam: true },
      }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      completedOrders,
      failedOrders,
      totalReports,
      successRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      recentOrders,
    };
  }

  /**
   * Get queue stats from BullMQ.
   */
  async getQueueStats() {
    const queues = [
      { name: 'dicom-process', queue: getDicomProcessQueue() },
      { name: 'storescu', queue: getStorescuQueue() },
      { name: 'webhook-retry', queue: getWebhookRetryQueue() },
    ];

    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => {
        const counts = await queue.getJobCounts();
        return { name, ...counts };
      })
    );

    return stats;
  }

  /**
   * Check all service connectivity.
   */
  async getConnectivity() {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

    // PostgreSQL
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'connected', latency: Date.now() - dbStart };
    } catch (err: any) {
      checks.database = { status: 'disconnected', error: err.message };
    }

    // Redis
    const redisStart = Date.now();
    try {
      const redis = getRedis();
      await redis.ping();
      checks.redis = { status: 'connected', latency: Date.now() - redisStart };
    } catch (err: any) {
      checks.redis = { status: 'disconnected', error: err.message };
    }

    // SATUSEHAT
    const ssStart = Date.now();
    try {
      const isHealthy = await satusehatClient.healthCheck();
      checks.satusehat = {
        status: isHealthy ? 'connected' : 'disconnected',
        latency: Date.now() - ssStart,
      };
    } catch (err: any) {
      checks.satusehat = { status: 'disconnected', error: err.message };
    }

    return checks;
  }

  /**
   * Get recent webhook logs.
   */
  async getWebhookLogs(limit: number = 20) {
    return prisma.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get failed jobs.
   */
  async getFailedJobs(limit: number = 20) {
    return prisma.failedJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get storage and retention stats.
   */
  async getStorageStats() {
    const limitGb = config.storage.maxStorageGB;
    const limitBytes = BigInt(limitGb) * BigInt(1024 * 1024 * 1024);

    const [
      activeStorageSum,
      completedStorageSum,
      failedStorageSum,
      deletedStudiesCount,
      largestStudies,
      oldestStudies,
      retentionHistory
    ] = await Promise.all([
      prisma.radiologyOrder.aggregate({
        _sum: { totalStorageBytes: true },
        where: { filesDeleted: false }
      }),
      prisma.radiologyOrder.aggregate({
        _sum: { totalStorageBytes: true },
        where: { filesDeleted: false, status: { in: ['COMPLETED', 'REPORT_CREATED'] } }
      }),
      prisma.radiologyOrder.aggregate({
        _sum: { totalStorageBytes: true },
        where: { filesDeleted: false, status: 'FAILED' }
      }),
      prisma.radiologyOrder.count({
        where: { filesDeleted: true }
      }),
      prisma.radiologyOrder.findMany({
        where: { filesDeleted: false, totalStorageBytes: { gt: 0 } },
        orderBy: { totalStorageBytes: 'desc' },
        take: 5,
        include: { exam: true }
      }),
      prisma.radiologyOrder.findMany({
        where: { filesDeleted: false, status: { in: ['COMPLETED', 'REPORT_CREATED'] } },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: { exam: true }
      }),
      prisma.radiologyOrder.findMany({
        where: { filesDeleted: true },
        orderBy: { filesDeletedAt: 'desc' },
        take: 10,
        include: { exam: true }
      })
    ]);

    const totalUsedBytes = activeStorageSum._sum.totalStorageBytes || BigInt(0);
    const completedUsedBytes = completedStorageSum._sum.totalStorageBytes || BigInt(0);
    const failedUsedBytes = failedStorageSum._sum.totalStorageBytes || BigInt(0);
    const availableBytes = limitBytes > totalUsedBytes ? limitBytes - totalUsedBytes : BigInt(0);

    return {
      limitGb,
      limitBytes: limitBytes.toString(),
      totalUsedBytes: totalUsedBytes.toString(),
      totalUsedMb: Number((Number(totalUsedBytes) / (1024 * 1024)).toFixed(2)),
      totalUsedGb: Number((Number(totalUsedBytes) / (1024 * 1024 * 1024)).toFixed(2)),
      availableBytes: availableBytes.toString(),
      availableMb: Number((Number(availableBytes) / (1024 * 1024)).toFixed(2)),
      availableGb: Number((Number(availableBytes) / (1024 * 1024 * 1024)).toFixed(2)),
      completedUsedBytes: completedUsedBytes.toString(),
      completedUsedMb: Number((Number(completedUsedBytes) / (1024 * 1024)).toFixed(2)),
      failedUsedBytes: failedUsedBytes.toString(),
      failedUsedMb: Number((Number(failedUsedBytes) / (1024 * 1024)).toFixed(2)),
      cleanupCount: deletedStudiesCount,
      deletedStudyCount: deletedStudiesCount,
      largestStudies: largestStudies.map(s => ({
        id: s.id,
        accessionNumber: s.accessionNumber,
        patientName: s.patientName,
        mrn: s.mrn,
        examName: s.exam?.examName,
        totalFiles: s.totalFiles,
        totalStorageMb: s.totalStorageMb,
        totalStorageBytes: s.totalStorageBytes.toString(),
        createdAt: s.createdAt,
      })),
      oldestStudies: oldestStudies.map(s => ({
        id: s.id,
        accessionNumber: s.accessionNumber,
        patientName: s.patientName,
        mrn: s.mrn,
        examName: s.exam?.examName,
        totalFiles: s.totalFiles,
        totalStorageMb: s.totalStorageMb,
        totalStorageBytes: s.totalStorageBytes.toString(),
        createdAt: s.createdAt,
      })),
      retentionHistory: retentionHistory.map(s => ({
        id: s.id,
        accessionNumber: s.accessionNumber,
        patientName: s.patientName,
        mrn: s.mrn,
        examName: s.exam?.examName,
        filesDeletedAt: s.filesDeletedAt,
        deletionReason: s.deletionReason,
        totalStorageMb: s.totalStorageMb,
      }))
    };
  }
}

export const monitoringService = new MonitoringService();
