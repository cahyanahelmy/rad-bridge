/**
 * DICOM processing types.
 */

export interface DicomMetadata {
  accessionNumber: string;
  studyDescription: string;
  institutionName: string;
  patientId: string;
}

export interface StoreScuOptions {
  aeTitle: string;
  host: string;
  port: number;
  filePath: string;
}

export interface DicomProcessingResult {
  success: boolean;
  originalPath: string;
  processedPath: string;
  error?: string;
}

export interface StoreScuResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}
