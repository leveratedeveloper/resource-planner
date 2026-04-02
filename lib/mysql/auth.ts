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
  private readonly TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes buffer
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;
  private loginPromise: Promise<string> | null = null; // Prevent concurrent logins

  constructor() {
    this.baseUrl = process.env.TIMETRACK_API_URL || 'http://127.0.0.1:8000/api/v1';
    this.username = process.env.MYSQL_API_USERNAME || 'super@timetrack.id';
    this.password = process.env.MYSQL_API_PASSWORD || '';
    this.tokenExpiryMs = parseInt(process.env.MYSQL_API_TOKEN_EXPIRY_MS || '3600000', 10);
  }

  /**
   * Check if logging should be enabled (development only)
   */
  private shouldLog(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Login and get access token
   */
  async login(): Promise<string> {
    // If login is already in progress, wait for it (concurrent login protection)
    if (this.loginPromise) {
      if (this.shouldLog()) {
        console.log('[MySQL Auth] Login already in progress, waiting...');
      }
      return this.loginPromise;
    }

    this.loginPromise = this.performLogin();

    try {
      const token = await this.loginPromise;
      return token;
    } finally {
      this.loginPromise = null;
    }
  }

  /**
   * Perform the actual login request
   */
  private async performLogin(): Promise<string> {
    try {
      const loginUrl = `${this.baseUrl}/login`;
      if (this.shouldLog()) {
        console.log('[MySQL Auth] Attempting login to:', loginUrl);
        console.log('[MySQL Auth] Using email:', this.username);
        console.log('[MySQL Auth] Password length:', this.password?.length);
      }

      const requestBody = JSON.stringify({
        email: this.username,
        password: this.password,
      });
      if (this.shouldLog()) {
        console.log('[MySQL Auth] Request body:', requestBody);
      }

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      if (this.shouldLog()) {
        console.log('[MySQL Auth] Response status:', response.status);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        if (this.shouldLog()) {
          console.error('[MySQL Auth] Login failed with status:', response.status, 'Response:', errorText);
        }
        throw new MySqlAuthError(`Login failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      if (this.shouldLog()) {
        console.log('[MySQL Auth] Login successful, response keys:', Object.keys(result));
        console.log('[MySQL Auth] Response structure:', JSON.stringify(result, null, 2));
      }

      const token = result.data.access_token;

      // Cache token with expiry
      this.cachedToken = token;
      this.tokenExpiry = Date.now() + this.tokenExpiryMs;

      return token;
    } catch (error) {
      if (this.shouldLog()) {
        console.error('[MySQL Auth] Login error:', {
          error: error instanceof Error ? error.message : error,
          cause: error instanceof Error ? error.cause : undefined,
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
      if (error instanceof MySqlAuthError) throw error;
      throw new MySqlAuthError(
        error instanceof Error ? error.message : 'Unknown login error'
      );
    }
  }

  /**
   * Get current valid token, login if needed
   * Optimized to use cached token if still valid (with 5min buffer)
   */
  async getToken(): Promise<string> {
    // Check if cached token is still valid (with 5min buffer before expiry)
    if (this.cachedToken && this.tokenExpiry) {
      const timeUntilExpiry = this.tokenExpiry - Date.now();
      if (timeUntilExpiry > this.TOKEN_REFRESH_BUFFER) {
        // Token is still valid, return cached token
        return this.cachedToken;
      }
    }

    // Token expired or missing, get new token
    return this.login();
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
    const token = globalThis.mysqlApiToken;
    const expiry = globalThis.mysqlApiTokenExpiry;
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
