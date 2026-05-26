import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { tokenManager } from './token-manager';
import { SatusehatError } from '../../lib/errors';

/**
 * Axios client pre-configured for SATUSEHAT FHIR API.
 * Automatically injects Bearer token from TokenManager.
 * Auto-retries on 401 (token expired).
 */
class SatusehatClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.satusehat.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: inject token
    this.client.interceptors.request.use(async (reqConfig) => {
      const token = await tokenManager.getToken();
      reqConfig.headers.Authorization = `Bearer ${token}`;
      return reqConfig;
    });

    // Response interceptor: handle 401 retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          tokenManager.invalidate();

          try {
            const newToken = await tokenManager.getToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (retryError) {
            throw retryError;
          }
        }

        // Log SATUSEHAT errors
        if (error.response) {
          logger.error({
            status: error.response.status,
            data: error.response.data,
            url: originalRequest?.url,
          }, 'SATUSEHAT API error');
        }

        throw error;
      }
    );
  }

  /**
   * GET request to SATUSEHAT FHIR API.
   */
  async get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.get<T>(path, { params });
      return response.data;
    } catch (error: any) {
      throw new SatusehatError(
        `SATUSEHAT GET ${path} failed: ${error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * POST request to SATUSEHAT FHIR API.
   */
  async post<T = any>(path: string, data: any): Promise<T> {
    try {
      const response = await this.client.post<T>(path, data);
      return response.data;
    } catch (error: any) {
      throw new SatusehatError(
        `SATUSEHAT POST ${path} failed: ${error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * PUT request to SATUSEHAT FHIR API.
   */
  async put<T = any>(path: string, data: any): Promise<T> {
    try {
      const response = await this.client.put<T>(path, data);
      return response.data;
    } catch (error: any) {
      throw new SatusehatError(
        `SATUSEHAT PUT ${path} failed: ${error.message}`,
        error.response?.data
      );
    }
  }

  /**
   * Fetch an Encounter by ID from SATUSEHAT.
   */
  async getEncounter(encounterId: string) {
    return this.get(`/fhir-r4/v1/Encounter/${encounterId}`);
  }

  /**
   * Create a ServiceRequest in SATUSEHAT.
   */
  async createServiceRequest(resource: any) {
    return this.post('/fhir-r4/v1/ServiceRequest', resource);
  }

  /**
   * Create a DiagnosticReport in SATUSEHAT.
   */
  async createDiagnosticReport(resource: any) {
    return this.post('/fhir-r4/v1/DiagnosticReport', resource);
  }

  /**
   * Create an Observation in SATUSEHAT.
   */
  async createObservation(resource: any) {
    return this.post('/fhir-r4/v1/Observation', resource);
  }

  /**
   * Search ImagingStudy by accession number (fallback query).
   */
  async searchImagingStudy(accessionNumber: string, orgId: string) {
    return this.get('/fhir-r4/v1/ImagingStudy', {
      identifier: `http://sys-ids.kemkes.go.id/acsn/${orgId}|${accessionNumber}`,
    });
  }

  /**
   * Health check: test SATUSEHAT connectivity by fetching a token.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await tokenManager.getToken();
      return true;
    } catch {
      return false;
    }
  }
}

export const satusehatClient = new SatusehatClient();
export default satusehatClient;
