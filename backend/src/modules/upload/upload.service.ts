import fs from 'fs/promises';
import path from 'path';
import dayjs from 'dayjs';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { getDicomProcessQueue, getStorescuQueue, getWebhookRetryQueue } from '../../services/queue/queue';
import { runCleanupIfNeeded, updateOrderStorageStats } from '../../services/storage/storage-manager';
import { dicomService } from '../dicom/dicom.service';

export class UploadService {
  /**
   * Handle DICOM file upload for a given order (by accession number).
   */
  async uploadDicom(accessionNumber: string, file: {
    filename: string;
    file: NodeJS.ReadableStream;
    mimetype: string;
  }) {
    // Validate file extension
    if (!file.filename.toLowerCase().endsWith('.dcm')) {
      throw new ValidationError('Only .dcm DICOM files are allowed');
    }

    // Sanitize filename to prevent path traversal (e.g. ../../etc/passwd.dcm)
    const safeFilename = path.basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeFilename || safeFilename.startsWith('.')) {
      throw new ValidationError('Invalid filename');
    }

    // Validate accession number format (prevent injection via URL params)
    if (!/^[A-Za-z0-9_-]+$/.test(accessionNumber)) {
      throw new ValidationError('Invalid accession number format');
    }

    // Find order
    const order = await prisma.radiologyOrder.findUnique({
      where: { accessionNumber },
      include: { exam: true },
    });

    if (!order) {
      throw new NotFoundError('RadiologyOrder', accessionNumber);
    }

    // Run storage cleanup if we are exceeding thresholds before uploading new file
    await runCleanupIfNeeded();

    // Build storage path: storage/YYYY/MM/ACCESSION/original/
    const now = dayjs();
    const storagePath = path.resolve(
      config.storage.basePath,
      now.format('YYYY'),
      now.format('MM'),
      accessionNumber,
      'original'
    );

    await fs.mkdir(storagePath, { recursive: true });

    const filePath = path.join(storagePath, safeFilename);

    // Save file
    await pipeline(file.file, createWriteStream(filePath));
    const stat = await fs.stat(filePath);

    logger.info({ accessionNumber, filePath, size: stat.size }, '✓ DICOM file saved');

    // Extract metadata using dcmdump
    const meta = await dicomService.extractMetadata(filePath);
    const fileSizeBytes = BigInt(stat.size);
    const fileSizeMb = Number((stat.size / (1024 * 1024)).toFixed(2));
    const studyDirPath = path.dirname(storagePath); // storage/YYYY/MM/ACCESSION

    // Create dicom_files record with all metadata
    const dicomFile = await prisma.dicomFile.create({
      data: {
        orderId: order.id,
        originalPath: filePath,
        fileName: file.filename,
        fileSize: fileSizeBytes,
        studyInstanceUid: meta.studyInstanceUid || null,
        seriesInstanceUid: meta.seriesInstanceUid || null,
        sopInstanceUid: meta.sopInstanceUid || null,
        fileSizeBytes,
        fileSizeMb,
        modalityCode: meta.modalityCode || order.exam.modalityCode || null,
        accessionNumber,
        storagePath: studyDirPath,
      },
    });

    // Update order with storage path and statistics
    await prisma.radiologyOrder.update({
      where: { id: order.id },
      data: {
        storagePath: studyDirPath,
      },
    });
    await updateOrderStorageStats(order.id);

    // Enqueue DICOM processing
    const dicomProcessQueue = getDicomProcessQueue();
    await dicomProcessQueue.add('process', {
      orderId: order.id,
      dicomFileId: dicomFile.id,
      accessionNumber,
      originalPath: filePath,
      studyDescription: order.exam.studyDescription,
      patientId: order.patientId || order.mrn || '',
    });

    logger.info({ accessionNumber }, 'DICOM processing enqueued');

    // Also enqueue storescu (will run after processing)
    const storescuQueue = getStorescuQueue();
    await storescuQueue.add('send', {
      orderId: order.id,
      dicomFileId: dicomFile.id,
      accessionNumber,
      processedPath: filePath.replace(/original/, 'processed'),
    }, {
      delay: 5000, // Wait 5s for processing to complete
    });

    // Schedule webhook retry fallback (runs after 60s)
    const webhookRetryQueue = getWebhookRetryQueue();
    await webhookRetryQueue.add('retry', {
      orderId: order.id,
      accessionNumber,
    }, {
      delay: 60000,
    });

    return {
      dicomFileId: dicomFile.id,
      accessionNumber,
      fileName: file.filename,
      fileSize: stat.size,
      status: 'QUEUED',
    };
  }
}

export const uploadService = new UploadService();
