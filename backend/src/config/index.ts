import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (try root first, then backend folder)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Fallback: load from ecosystem.config.js
let ecosystemConfig: Record<string, any> = {};
try {
  ecosystemConfig = require(path.resolve(__dirname, '../../ecosystem.config.js'));
} catch {
  // ecosystem.config.js is optional
}

export const config = {
  app: {
    name: 'RIS Bridge',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
  },

  server: {
    host: process.env.APP_HOST || '0.0.0.0',
    port: parseInt(process.env.APP_PORT || '3000', 10),
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mini_ris',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  satusehat: {
    baseUrl: process.env.SATUSEHAT_BASE_URL || 'https://api-satusehat-stg.dto.kemkes.go.id',
    authUrl: process.env.SATUSEHAT_AUTH_URL || 'https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1',
    orgId: process.env.SATUSEHAT_ORG_ID || '',
    clientKey: process.env.SATUSEHAT_CLIENT_KEY || '',
    secretKey: process.env.SATUSEHAT_SECRET_KEY || '',
  },

  dicomRouter: {
    aeTitle: process.env.DICOM_ROUTER_AE_TITLE || 'DCMROUTER',
    host: process.env.DICOM_ROUTER_HOST || '127.0.0.1',
    port: parseInt(process.env.DICOM_ROUTER_PORT || '11112', 10),
    containerName: process.env.DICOM_ROUTER_CONTAINER || 'dicom-router-mini',
    tz: process.env.DICOM_ROUTER_TZ || 'Asia/Jakarta',
    httpPort: parseInt(process.env.DICOM_ROUTER_HTTP_PORT || '8089', 10),
    pathSuffixDicom: process.env.DICOM_ROUTER_PATHSUFFIX_DICOM || '/dicom/v1/dicomWeb/studies',
    pathSuffixFhir: process.env.DICOM_ROUTER_PATHSUFFIX_FHIR || '/fhir-r4/v1',
  },

  container: {
    runtime: (process.env.CONTAINER_RUNTIME || 'docker') as 'docker' | 'podman',
  },

  storage: {
    basePath: path.resolve(__dirname, '../../../', process.env.STORAGE_PATH || './storage'),
    maxStorageGB: parseInt(process.env.STORAGE_MAX_GB || '40', 10),
    cleanupStrategy: process.env.STORAGE_CLEANUP_STRATEGY || 'FIFO',
    cleanupOnlyCompleted: process.env.STORAGE_CLEANUP_ONLY_COMPLETED !== 'false',
    autoCleanup: process.env.STORAGE_AUTO_CLEANUP !== 'false',
    maxRetryCount: parseInt(process.env.STORAGE_MAX_RETRY_COUNT || '3', 10),
    deleteFailedDicomAfterRetryExceeded: process.env.STORAGE_DELETE_FAILED_DICOM_AFTER_RETRY !== 'false',
  },

  institution: {
    name: process.env.INSTITUTION_NAME || 'Rumah Sakit Contoh',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-to-a-strong-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  webhook: {
    username: process.env.WEBHOOK_USERNAME || 'risbridge',
    password: process.env.WEBHOOK_PASSWORD || 'risbridge-webhook-secret',
    callbackUrl: process.env.WEBHOOK_CALLBACK_URL || 'http://host.docker.internal:3000/api/dicom-router/callback',
  },

  queue: {
    maxRetries: 3,
    retryDelay: 5000,
    backoffType: 'exponential' as const,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export type AppConfig = typeof config;
export default config;
