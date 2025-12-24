import { HttpClientOptions } from '../types';
import { Logger } from '../logger';
/**
 * Create HTTP client with proper configuration
 */
export declare class HttpClient {
    private baseUrl;
    private token?;
    private ignoreCertErrors;
    private logger;
    constructor(options: HttpClientOptions, logger: Logger);
    /**
     * Make HTTP request
     */
    request<T>(method: string, path: string, body?: unknown): Promise<T>;
    /**
     * GET request
     */
    get<T>(path: string): Promise<T>;
    /**
     * POST request
     */
    post<T>(path: string, body?: unknown): Promise<T>;
    /**
     * DELETE request
     */
    delete<T>(path: string): Promise<T>;
}
//# sourceMappingURL=http-client.d.ts.map