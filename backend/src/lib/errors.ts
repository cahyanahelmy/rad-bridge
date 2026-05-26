/**
 * Custom error classes for RIS Bridge.
 * Used throughout the application for consistent error handling.
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const msg = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(msg, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class SatusehatError extends AppError {
  public readonly satusehatResponse?: any;

  constructor(message: string, satusehatResponse?: any) {
    super(message, 502, 'SATUSEHAT_ERROR');
    this.satusehatResponse = satusehatResponse;
  }
}

export class DicomError extends AppError {
  constructor(message: string) {
    super(message, 500, 'DICOM_PROCESSING_ERROR');
  }
}

export class InfrastructureError extends AppError {
  constructor(message: string) {
    super(message, 503, 'INFRASTRUCTURE_ERROR');
  }
}
