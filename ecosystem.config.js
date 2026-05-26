/*
|==========================================================================
| RIS Bridge — Ecosystem Configuration
|==========================================================================
|
| Centralized orchestration configuration for RIS Bridge.
|
| This file is the single source of truth for:
|   - deployment settings
|   - infrastructure settings
|   - SATUSEHAT integration settings
|   - Docker/Podman settings
|   - runtime orchestration
|
| This file is designed to be readable by:
|   - hospital IT staff
|   - implementation engineers
|   - non-DevOps operators
|
| HOW TO USE:
|   1. Copy this file if needed for environment-specific overrides
|   2. Adjust values below to match your hospital infrastructure
|   3. Restart the application after changes
|
|==========================================================================
*/

module.exports = {

  /*
  |--------------------------------------------------------------------------
  | Application Configuration
  |--------------------------------------------------------------------------
  |
  | General application settings.
  |
  | name     : Display name shown in logs and dashboard
  | version  : Current application version
  | env      : Environment (development / staging / production)
  |
  */
  app: {
    name: "RIS Bridge",
    version: "1.0.0",
    env: process.env.NODE_ENV || "development",
  },

  /*
  |--------------------------------------------------------------------------
  | Backend Server Configuration
  |--------------------------------------------------------------------------
  |
  | Fastify server settings.
  |
  | host : Bind address (0.0.0.0 = all interfaces)
  | port : HTTP port for the API server
  |
  | Default Local Development:
  |   Host : 0.0.0.0
  |   Port : 3000
  |
  | Access the API at: http://localhost:3000
  |
  */
  server: {
    host: process.env.APP_HOST || "0.0.0.0",
    port: parseInt(process.env.APP_PORT || "3000", 10),
  },

  /*
  |--------------------------------------------------------------------------
  | PostgreSQL Configuration
  |--------------------------------------------------------------------------
  |
  | Database used by RIS Bridge for all persistent data.
  |
  | Default Local Development:
  |
  |   Host     : localhost
  |   Port     : 5432
  |   Database : mini_ris
  |   Username : postgres
  |   Password : postgres
  |
  | Connection URL format:
  |   postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
  |
  | IMPORTANT:
  |   Change password in production!
  |
  */
  database: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mini_ris",
  },

  /*
  |--------------------------------------------------------------------------
  | Redis Configuration
  |--------------------------------------------------------------------------
  |
  | Redis is used for:
  |   - BullMQ job queues (DICOM processing, storescu, webhooks)
  |   - Optional token caching
  |   - Session management
  |
  | Default Local Development:
  |
  |   Host     : localhost
  |   Port     : 6379
  |   Password : (empty / no password)
  |
  | IMPORTANT:
  |   Redis MUST be running before starting RIS Bridge.
  |   Install via Docker: docker run -d -p 6379:6379 redis:alpine
  |
  */
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  /*
  |--------------------------------------------------------------------------
  | SATUSEHAT Integration
  |--------------------------------------------------------------------------
  |
  | Credentials and endpoints for SATUSEHAT FHIR API.
  |
  | Obtain credentials from:
  |   https://satusehat.kemkes.go.id/platform/
  |
  | Environments:
  |   Sandbox    : https://api-satusehat-stg.dto.kemkes.go.id
  |   Production : https://api-satusehat.kemkes.go.id
  |
  | IMPORTANT:
  |   - Never commit real credentials to version control
  |   - Use .env file for sensitive values
  |   - Organization ID is your fasyankes ID in SATUSEHAT
  |
  */
  satusehat: {
    baseUrl: process.env.SATUSEHAT_BASE_URL || "https://api-satusehat.kemkes.go.id",
    authUrl: process.env.SATUSEHAT_AUTH_URL || "https://api-satusehat.kemkes.go.id/oauth2/v1",
    orgId: process.env.SATUSEHAT_ORG_ID || "",
    clientKey: process.env.SATUSEHAT_CLIENT_KEY || "",
    secretKey: process.env.SATUSEHAT_SECRET_KEY || "",
  },

  /*
  |--------------------------------------------------------------------------
  | DICOM Router Configuration
  |--------------------------------------------------------------------------
  |
  | Settings for communicating with the SATUSEHAT DICOM Router.
  |
  | The DICOM Router receives DICOM files via storescu and
  | creates ImagingStudy resources in SATUSEHAT automatically.
  |
  | AE Title  : Application Entity title of the DICOM Router
  | Host      : IP address of the DICOM Router
  | Port      : DICOM port (default: 11112)
  |
  | storescu command format:
  |   storescu -aec {aeTitle} {host} {port} file.dcm
  |
  */
  dicomRouter: {
    aeTitle: process.env.DICOM_ROUTER_AE_TITLE || "DCMROUTER",
    host: process.env.DICOM_ROUTER_HOST || "127.0.0.1",
    port: parseInt(process.env.DICOM_ROUTER_PORT || "11112", 10),
    containerName: process.env.DICOM_ROUTER_CONTAINER || "dicom-router",
  },

  /*
  |--------------------------------------------------------------------------
  | Container Runtime Configuration
  |--------------------------------------------------------------------------
  |
  | RIS Bridge can manage DICOM Router containers via Docker or Podman.
  |
  | Options:
  |   "docker" — Use Docker (most common)
  |   "podman" — Use Podman (rootless alternative)
  |
  | The selected runtime will be used for:
  |   - Starting/stopping DICOM Router
  |   - Container health monitoring
  |   - Log retrieval
  |
  */
  container: {
    runtime: process.env.CONTAINER_RUNTIME || "docker",
  },

  /*
  |--------------------------------------------------------------------------
  | DICOM Storage Configuration
  |--------------------------------------------------------------------------
  |
  | Path where uploaded DICOM files are stored.
  |
  | Structure:
  |   storage/
  |     YYYY/
  |       MM/
  |         ACCESSION-NUMBER/
  |           original/    ← original uploaded file (never modified)
  |           processed/   ← copy with injected metadata (sent to router)
  |
  | IMPORTANT:
  |   - Original files are NEVER overwritten
  |   - Ensure sufficient disk space for DICOM files
  |   - Recommended: use a dedicated volume/partition
  |
  */
  storage: {
    basePath: process.env.STORAGE_PATH || "./storage",
  },

  /*
  |--------------------------------------------------------------------------
  | Institution Configuration
  |--------------------------------------------------------------------------
  |
  | Hospital/institution details injected into DICOM metadata.
  |
  | This value is written to DICOM tag (0008,0080) Institution Name
  | using dcmodify during DICOM processing.
  |
  */
  institution: {
    name: process.env.INSTITUTION_NAME || "Rumah Sakit Contoh",
  },

  /*
  |--------------------------------------------------------------------------
  | JWT Authentication Configuration
  |--------------------------------------------------------------------------
  |
  | Settings for JSON Web Token authentication.
  |
  | secret          : Secret key for signing tokens
  | expiresIn       : Access token expiry (e.g., "1h", "30m")
  | refreshExpiresIn : Refresh token expiry (e.g., "7d", "30d")
  |
  | IMPORTANT:
  |   Generate a strong secret for production:
  |   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  |
  */
  jwt: {
    secret: process.env.JWT_SECRET || "change-this-to-a-strong-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  /*
  |--------------------------------------------------------------------------
  | Webhook Configuration
  |--------------------------------------------------------------------------
  |
  | HTTP Basic Auth credentials for the DICOM Router webhook endpoint.
  |
  | The DICOM Router sends ImagingStudy callbacks to:
  |   POST /api/dicom-router/callback
  |
  | Protected with HTTP Basic Authentication.
  |
  */
  webhook: {
    username: process.env.WEBHOOK_USERNAME || "risbridge",
    password: process.env.WEBHOOK_PASSWORD || "risbridge-webhook-secret",
  },

  /*
  |--------------------------------------------------------------------------
  | Queue Configuration (BullMQ)
  |--------------------------------------------------------------------------
  |
  | Job queue settings for asynchronous DICOM processing.
  |
  | Queues:
  |   dicom-process  — DICOM metadata injection (dcmodify)
  |   storescu       — Send DICOM to router (storescu)
  |   webhook-retry  — Fallback ImagingStudy query
  |
  | maxRetries     : Maximum retry attempts for failed jobs
  | retryDelay     : Base delay between retries in milliseconds
  | backoffType    : Retry strategy ("exponential" or "fixed")
  |
  */
  queue: {
    maxRetries: 3,
    retryDelay: 5000,
    backoffType: "exponential",
  },

  /*
  |--------------------------------------------------------------------------
  | Logging Configuration
  |--------------------------------------------------------------------------
  |
  | Log level controls verbosity:
  |   "fatal"   — Only fatal errors
  |   "error"   — Errors
  |   "warn"    — Warnings and above
  |   "info"    — General info (recommended for production)
  |   "debug"   — Detailed debug info
  |   "trace"   — Very detailed trace info
  |
  */
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};
