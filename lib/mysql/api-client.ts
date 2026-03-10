/**
 * MySQL REST API Client
 * Handles all HTTP communication with the MySQL API
 */

import { getMySqlAuthManager } from './auth';
import type {
  MySqlApiResponse,
  MySqlBrand,
  MySqlCampaign,
  MySqlPitch,
  MySqlEmployee,
  MySqlQueryParams,
  ErrorType,
  EnhancedApiError,
} from '../types/mysql';
import { MySqlApiError } from '../types/mysql';

class MySqlApiClient {
  private baseUrl: string;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 3000]; // Exponential backoff in ms

  constructor() {
    this.baseUrl = process.env.MYSQL_API_BASE_URL || 'http://localhost/api/v1';
  }

  /**
   * Classify error type for better handling
   */
  private classifyError(error: unknown): ErrorType {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return 'network';
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return 'timeout';
    }
    if (error instanceof MySqlApiError && error.statusCode === 401) {
      return 'auth';
    }
    if (error instanceof SyntaxError) {
      return 'parse';
    }
    return 'unknown';
  }

  /**
   * Create timeout promise that aborts the request
   */
  private createTimeoutController(abortController: AbortController): NodeJS.Timeout {
    return setTimeout(() => {
      abortController.abort();
    }, this.REQUEST_TIMEOUT);
  }

  /**
   * Wait for specified delay (for retry backoff)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown, errorType: ErrorType): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (errorType === 'network' || errorType === 'timeout') {
      return true;
    }
    if (error instanceof MySqlApiError && error.statusCode >= 500) {
      return true;
    }
    // Don't retry on 4xx client errors (except 429 too many requests)
    if (error instanceof MySqlApiError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
      return false;
    }
    return false;
  }

  /**
   * Make authenticated API request with timeout, retry, and enhanced error handling
   */
  private async request<T>(
    endpoint: string,
    params?: MySqlQueryParams,
  ): Promise<MySqlApiResponse<T>> {
    const authManager = getMySqlAuthManager();
    let lastError: unknown;
    let lastErrorType: ErrorType = 'unknown';

    // Build URL with query parameters
    const buildUrl = (): URL => {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      if (params) {
        if (params.page) url.searchParams.set('page', String(params.page));
        if (params.per_page) url.searchParams.set('per_page', String(params.per_page));
        if (params.search) url.searchParams.set('search', params.search);
        if (params.include) url.searchParams.set('include', params.include);
        if (params.brand_id) url.searchParams.set('brand_id', params.brand_id);
      }
      return url;
    };

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Get Bearer token for authentication (refresh on each attempt if needed)
        const token = await authManager.getToken();
        const url = buildUrl();

        console.log(`[MySqlApiClient] Request (attempt ${attempt}/${this.MAX_RETRIES}):`, {
          endpoint,
          fullUrl: url.toString(),
          hasToken: !!token,
          tokenPreview: token ? `${token.substring(0, 10)}...` : 'none',
        });

        // Set up timeout
        const controller = new AbortController();
        const timeoutId = this.createTimeoutController(controller);

        try {
          // Make request with Bearer token and timeout signal
          const response = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            signal: controller.signal,
            cache: 'no-store',
          });

          // Clear timeout on successful response
          clearTimeout(timeoutId);

          console.log('[MySqlApiClient] Response:', {
            endpoint,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          });

          if (!response.ok) {
            // Handle 401 - token expired, clear cache
            if (response.status === 401) {
              authManager.clearToken();
            }
            throw new MySqlApiError(`API Error: ${response.statusText}`, response.status);
          }

          // Get raw response as text first for better error logging
          const responseText = await response.text();
          const contentType = response.headers.get('content-type');

          console.log('[MySqlApiClient] Raw response:', {
            endpoint,
            status: response.status,
            contentType,
            contentLength: responseText.length,
            responsePreview: responseText.substring(0, 500),
          });

          // Try to parse JSON
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('[MySqlApiClient] JSON parse failed:', {
              endpoint,
              parseError: parseError instanceof Error ? parseError.message : parseError,
              contentType,
              responsePreview: responseText.substring(0, 500),
            });
            throw new MySqlApiError(
              `Invalid JSON response from ${endpoint}: ${responseText.substring(0, 100)}`,
              response.status
            );
          }

          console.log('[MySqlApiClient] Response data preview:', JSON.stringify(data).substring(0, 500));

          // Success! Return the data
          return data;
        } catch (fetchError) {
          // Clear timeout if still active
          clearTimeout(timeoutId);

          // Classify the error
          const errorType = this.classifyError(fetchError);
          lastError = fetchError;
          lastErrorType = errorType;

          console.error(`[MySqlApiClient] Attempt ${attempt} failed:`, {
            endpoint,
            errorType,
            error: fetchError instanceof Error ? fetchError.message : fetchError,
          });

          // Check if we should retry
          if (attempt < this.MAX_RETRIES && this.isRetryableError(fetchError, errorType)) {
            const retryDelay = this.RETRY_DELAYS[attempt - 1];
            console.log(`[MySqlApiClient] Retrying in ${retryDelay}ms...`);
            await this.delay(retryDelay);
            continue;
          }

          // Not retryable or out of retries - throw the error
          throw fetchError;
        }
      } catch (error) {
        // This is our final attempt or non-retryable error
        const errorType = this.classifyError(error);
        lastError = error;
        lastErrorType = errorType;

        console.error('[MySqlApiClient] Request failed after all retries:', {
          endpoint,
          baseUrl: this.baseUrl,
          errorType,
          attempt,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Return structured error response instead of crashing
        const enhancedError: EnhancedApiError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: errorType,
          originalError: error,
        };

        return {
          status: 500,
          success: false,
          message: `Request failed: ${enhancedError.message}`,
          error: enhancedError,
          data: [] as T,
        };
      }
    }

    // Should never reach here, but TypeScript needs it
    return {
      status: 500,
      success: false,
      message: 'Request failed: Maximum retries exceeded',
      error: {
        message: 'Maximum retries exceeded',
        type: 'unknown',
        originalError: lastError,
      },
      data: [] as T,
    };
  }

  /**
   * Get brands with pagination
   */
  getBrands(params?: MySqlQueryParams): Promise<MySqlApiResponse<any>> {
    return this.request<any>('/brands', params);
  }

  /**
   * Get campaigns (projects) with pagination
   */
  getCampaigns(params?: MySqlQueryParams): Promise<MySqlApiResponse<any>> {
    return this.request<any>('/campaigns', params);
  }

  /**
   * Get pitches with pagination
   */
  async getPitches(params?: MySqlQueryParams): Promise<MySqlApiResponse<any>> {
    console.log('[MySqlApiClient] getPitches called with params:', params);
    const result = await this.request<any>('/pitches', params);
    console.log('[MySqlApiClient] getPitches result:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Get employees with pagination
   */
  getEmployees(params?: MySqlQueryParams): Promise<MySqlApiResponse<any>> {
    return this.request<any>('/employees', params);
  }

  /**
   * Get single brand by UUID
   */
  getBrand(uuid: string): Promise<MySqlApiResponse<MySqlBrand>> {
    return this.request<MySqlBrand>(`/brands/${uuid}`);
  }

  /**
   * Get single campaign by UUID
   */
  getCampaign(uuid: string): Promise<MySqlApiResponse<MySqlCampaign>> {
    return this.request<MySqlCampaign>(`/campaigns/${uuid}`);
  }

  /**
   * Get single pitch by UUID
   */
  getPitch(uuid: string): Promise<MySqlApiResponse<MySqlPitch>> {
    return this.request<MySqlPitch>(`/pitches/${uuid}`);
  }

  /**
   * Get single employee by UUID
   */
  getEmployee(uuid: string): Promise<MySqlApiResponse<MySqlEmployee>> {
    return this.request<MySqlEmployee>(`/employees/${uuid}`);
  }
}

// Singleton instance
let apiClientInstance: MySqlApiClient | null = null;

export function getMySqlApiClient(): MySqlApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new MySqlApiClient();
  }
  return apiClientInstance;
}

// Re-export error type for convenience
export { MySqlApiError } from '../types/mysql';
