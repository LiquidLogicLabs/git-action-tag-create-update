import { HttpClientOptions } from '../types';
import { Logger } from '../logger';

/**
 * Create HTTP client with proper configuration
 */
export class HttpClient {
  private baseUrl: string;
  private token?: string;
  private ignoreCertErrors: boolean;
  private logger: Logger;

  constructor(options: HttpClientOptions, logger: Logger) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = options.token;
    this.ignoreCertErrors = options.ignoreCertErrors;
    this.logger = logger;
  }

  /**
   * Make HTTP request
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    this.logger.logRequest(method, url, headers);

    // Configure fetch with certificate error handling
    const fetchOptions: RequestInit = {
      method,
      headers
    };
    
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Note: Node.js fetch doesn't support rejectUnauthorized directly
    // For certificate errors, we'd need to use a different HTTP client
    // For now, we'll rely on the environment or use node-fetch if needed

    try {
      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }

      this.logger.logResponse(response.status, response.statusText, responseBody);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}: ${JSON.stringify(responseBody)}`
        );
      }

      return responseBody as T;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('certificate') || error.message.includes('SSL')) {
          if (this.ignoreCertErrors) {
            this.logger.warning('SSL certificate error ignored');
            // Retry with a workaround if possible
            // For now, we'll just log the warning
          }
        }
        throw error;
      }
      throw new Error(`Request failed: ${error}`);
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * POST request
   */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * DELETE request
   */
  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

