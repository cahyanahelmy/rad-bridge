import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { SatusehatError } from '../../lib/errors';
import type { SatusehatTokenResponse } from '../../types/fhir';

/**
 * Singleton SATUSEHAT Token Manager.
 *
 * Features:
 * - Auto fetch token on first request
 * - Auto refresh before expiry (with buffer)
 * - In-memory cache
 * - Concurrency-safe (mutex for refresh)
 * - Minimizes auth requests to SATUSEHAT
 */
class TokenManager {
  private accessToken: string | null = null;
  private expiresAt: number = 0;
  private refreshPromise: Promise<string> | null = null;

  // Refresh 60 seconds before actual expiry
  private readonly REFRESH_BUFFER_MS = 60 * 1000;

  /**
   * Get a valid access token. Auto-refreshes if expired or about to expire.
   */
  async getToken(): Promise<string> {
    // If token is still valid, return cached
    if (this.accessToken && Date.now() < this.expiresAt - this.REFRESH_BUFFER_MS) {
      return this.accessToken;
    }

    // Concurrency-safe: if a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start refresh
    this.refreshPromise = this.fetchToken();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Fetch a new token from SATUSEHAT OAuth2 endpoint.
   */
  private async fetchToken(): Promise<string> {
    const { authUrl, clientKey, secretKey } = config.satusehat;

    if (!clientKey || !secretKey) {
      throw new SatusehatError(
        'SATUSEHAT credentials not configured. Set SATUSEHAT_CLIENT_KEY and SATUSEHAT_SECRET_KEY in .env'
      );
    }

    try {
      logger.debug('Fetching SATUSEHAT token...');

      const response = await axios.post<SatusehatTokenResponse>(
        `${authUrl}/accesstoken?grant_type=client_credentials`,
        new URLSearchParams({
          client_id: clientKey,
          client_secret: secretKey,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      );

      const { access_token, expires_in } = response.data;

      this.accessToken = access_token;
      this.expiresAt = Date.now() + expires_in * 1000;

      logger.info(
        `✓ SATUSEHAT token acquired (expires in ${expires_in}s)`
      );

      return access_token;
    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      logger.error({ err: error }, `✗ SATUSEHAT token fetch failed: ${message}`);
      throw new SatusehatError(`Failed to fetch SATUSEHAT token: ${message}`, error.response?.data);
    }
  }

  /**
   * Force clear cached token (e.g., on 401 response).
   */
  invalidate(): void {
    this.accessToken = null;
    this.expiresAt = 0;
    logger.debug('SATUSEHAT token invalidated');
  }

  /**
   * Check if we currently have a valid (non-expired) token.
   */
  isValid(): boolean {
    return !!this.accessToken && Date.now() < this.expiresAt - this.REFRESH_BUFFER_MS;
  }
}

// Export singleton instance
export const tokenManager = new TokenManager();
export default tokenManager;
