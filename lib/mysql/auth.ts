/**
 * MySQL API Authentication Manager
 * Handles login, token storage, and refresh
 */

import { MySqlAuthError } from '../types/mysql';

const TOKEN_KEY = 'mysql_api_token';
const TOKEN_EXPIRY_KEY = 'mysql_api_token_expiry';

export class MySqlAuthManager {
  private baseUrl: string;
  private username: string;
  private password: string;
  private tokenExpiryMs: number;
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.baseUrl = process.env.MYSQL_API_BASE_URL || 'http://localhost/api/v1';
    this.username = process.env.MYSQL_API_USERNAME || 'super@timetrack.id';
    this.password = process.env.MYSQL_API_PASSWORD || '';
    this.tokenExpiryMs = parseInt(process.env.MYSQL_API_TOKEN_EXPIRY_MS || '3600000', 10);
  }

  /**
   * Login and get access token
   */
  async login(): Promise<string> {
    try {
      const loginUrl = `${this.baseUrl}/login`;
      console.log('[MySQL Auth] Attempting login to:', loginUrl);
      console.log('[MySQL Auth] Using email:', this.username);
      console.log('[MySQL Auth] Password length:', this.password?.length);

      const requestBody = JSON.stringify({
        email: this.username,
        password: this.password,
      });
      console.log('[MySQL Auth] Request body:', requestBody);

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      console.log('[MySQL Auth] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[MySQL Auth] Login failed with status:', response.status, 'Response:', errorText);
        throw new MySqlAuthError(`Login failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('[MySQL Auth] Login successful, response keys:', Object.keys(result));
      console.log('[MySQL Auth] Response structure:', JSON.stringify(result, null, 2));

      const token = result.data.access_token;

      // Cache token with expiry
      this.cachedToken = token;
      this.tokenExpiry = Date.now() + this.tokenExpiryMs;

      return token;
    } catch (error) {
      console.error('[MySQL Auth] Login error:', {
        error: error instanceof Error ? error.message : error,
        cause: error instanceof Error ? error.cause : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof MySqlAuthError) throw error;
      throw new MySqlAuthError(
        error instanceof Error ? error.message : 'Unknown login error'
      );
    }
  }

  /**
   * Get current valid token, login if needed
   */
  async getToken(): Promise<string> {
    // Check if cached token is still valid
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    // Login to get new token
    return await this.login();
  }

  /**
   * Clear all token caches (in-memory and stored)
   */
  clearToken(): void {
    // Clear in-memory cache
    this.cachedToken = null;
    this.tokenExpiry = null;

    // Clear stored token
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } else {
      globalThis.mysqlApiToken = undefined;
      globalThis.mysqlApiTokenExpiry = undefined;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    const expiry = this.getTokenExpiry();
    return !!(token && expiry && Date.now() < expiry);
  }
}

// Extend global type for server-side token storage
declare global {
  var mysqlApiToken: string | undefined;
  var mysqlApiTokenExpiry: number | undefined;
}

// Singleton instance
let authManagerInstance: MySqlAuthManager | null = null;

export function getMySqlAuthManager(): MySqlAuthManager {
  if (!authManagerInstance) {
    authManagerInstance = new MySqlAuthManager();
  }
  return authManagerInstance;
}
