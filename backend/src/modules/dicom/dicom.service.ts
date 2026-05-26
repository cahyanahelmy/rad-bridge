import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import type { DicomMetadata, DicomProcessingResult, StoreScuResult } from '../../types/dicom';

const execAsync = (command: string, options: any = {}): Promise<{ stdout: string; stderr: string }> =>
  promisify(exec)(command, { windowsHide: true, ...options }) as any;

/**
 * Sanitize shell argument to prevent OS command injection.
 * Strips dangerous characters: backticks, $(), semicolons, pipes, etc.
 */
function sanitizeShellArg(value: string): string {
  return value.replace(/[`$;|&(){}\[\]!<>\\"'\n\r]/g, '');
}

export class DicomService {
  /**
   * Process a DICOM file:
   * 1. Copy original to processed folder
   * 2. Inject metadata using dcmodify
   */
  async processFile(params: {
    originalPath: string;
    accessionNumber: string;
    studyDescription: string;
    patientId: string;
  }): Promise<DicomProcessingResult> {
    const { originalPath, accessionNumber, studyDescription, patientId } = params;

    try {
      // Determine processed path
      const dir = path.dirname(originalPath);
      const processedDir = dir.replace(/original$/, 'processed');
      const fileName = path.basename(originalPath);
      const processedPath = path.join(processedDir, fileName);

      // Ensure processed directory exists
      await fs.mkdir(processedDir, { recursive: true });

      // Copy file
      await fs.copyFile(originalPath, processedPath);
      logger.debug({ originalPath, processedPath }, 'DICOM file copied to processed');

      // Inject metadata using dcmodify
      await this.injectMetadata(processedPath, {
        accessionNumber,
        studyDescription,
        institutionName: config.institution.name,
        patientId,
      });

      return {
        success: true,
        originalPath,
        processedPath,
      };
    } catch (error: any) {
      logger.error({ err: error, originalPath }, 'DICOM processing failed');
      return {
        success: false,
        originalPath,
        processedPath: '',
        error: error.message,
      };
    }
  }

  /**
   * Inject DICOM metadata using dcmodify.
   */
  private async injectMetadata(filePath: string, metadata: DicomMetadata): Promise<void> {
    const { accessionNumber, studyDescription, institutionName, patientId } = metadata;

    // Build dcmodify command — sanitize all user-provided values against injection
    const args = [
      `dcmodify`,
      `-i "(0008,0050)=${sanitizeShellArg(accessionNumber)}"`,   // Accession Number
      `-i "(0008,1030)=${sanitizeShellArg(studyDescription)}"`,   // Study Description
      `-i "(0008,0080)=${sanitizeShellArg(institutionName)}"`,     // Institution Name
      `-i "(0010,0020)=${sanitizeShellArg(patientId)}"`,           // Patient ID
      `-nb`,                                     // No backup
      `"${filePath}"`,
    ];

    const command = args.join(' ');
    logger.debug({ command }, 'Running dcmodify');

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      if (stderr && !stderr.includes('W:')) {
        logger.warn({ stderr }, 'dcmodify warnings');
      }
      logger.info({ accessionNumber }, '✓ DICOM metadata injected');
    } catch (error: any) {
      logger.error({ err: error, filePath }, '✗ dcmodify failed');
      throw new Error(`dcmodify failed: ${error.message}`);
    }
  }

  /**
   * Send DICOM file to router using storescu.
   */
  async sendToRouter(filePath: string): Promise<StoreScuResult> {
    const { aeTitle, host, port } = config.dicomRouter;
    const command = `storescu -aec ${aeTitle} ${host} ${port} "${filePath}"`;

    logger.debug({ command }, 'Running storescu');

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

      return {
        success: true,
        exitCode: 0,
        stdout,
        stderr,
      };
    } catch (error: any) {
      logger.error({ err: error, filePath }, '✗ storescu failed');
      return {
        success: false,
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        error: error.message,
      };
    }
  }

  /**
   * Ekstrak metadata penting dari DICOM file menggunakan dcmdump.
   */
  async extractMetadata(filePath: string) {
    const command = `dcmdump +P "(0020,000d)" +P "(0020,000e)" +P "(0008,0018)" +P "(0008,0060)" +P "(0010,0020)" +P "(0008,0050)" +P "(0008,1030)" "${filePath}"`;
    try {
      const { stdout } = await execAsync(command, { timeout: 15000 });
      
      const getTagValue = (tag: string): string => {
        const regex = new RegExp(`\\(${tag}\\)[^\\[]*\\[([^\\]]*)\\]`);
        const match = stdout.match(regex);
        return match ? match[1].trim() : '';
      };

      return {
        studyInstanceUid: getTagValue("0020,000d"),
        seriesInstanceUid: getTagValue("0020,000e"),
        sopInstanceUid: getTagValue("0008,0018"),
        modalityCode: getTagValue("0008,0060"),
        patientId: getTagValue("0010,0020"),
        accessionNumber: getTagValue("0008,0050"),
        studyDescription: getTagValue("0008,1030"),
      };
    } catch (error: any) {
      logger.error({ err: error, filePath }, 'Failed to extract DICOM metadata using dcmdump');
      return {
        studyInstanceUid: '',
        seriesInstanceUid: '',
        sopInstanceUid: '',
        modalityCode: '',
        patientId: '',
        accessionNumber: '',
        studyDescription: '',
      };
    }
  }
}

export const dicomService = new DicomService();
