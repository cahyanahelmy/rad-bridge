/**
 * Shared types for RIS Bridge.
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  RADIOGRAPHER = 'RADIOGRAPHER',
  RADIOLOGIST = 'RADIOLOGIST',
}

export enum OrderStatus {
  WAITING_UPLOAD = 'WAITING_UPLOAD',
  DICOM_RECEIVED = 'DICOM_RECEIVED',
  IMAGING_CREATED = 'IMAGING_CREATED',
  REPORT_CREATED = 'REPORT_CREATED',
  FAILED = 'FAILED',
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
