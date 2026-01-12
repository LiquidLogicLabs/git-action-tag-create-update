"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
/**
 * Create HTTP client with proper configuration
 */
class HttpClient {
    baseUrl;
    token;
    ignoreCertErrors;
    logger;
    constructor(options, logger) {
        this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.token = options.token;
        this.ignoreCertErrors = options.ignoreCertErrors;
        this.logger = logger;
    }
    /**
     * Make HTTP request
     */
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }
        // Log HTTP request (only if verbose is enabled)
        this.logger.debug(`HTTP ${method} ${url}`);
        if (this.logger.verbose && headers) {
            const sanitizedHeaders = { ...headers };
            if (sanitizedHeaders.Authorization) {
                sanitizedHeaders.Authorization = '***';
            }
            this.logger.debug(`Headers: ${JSON.stringify(sanitizedHeaders, null, 2)}`);
        }
        // Configure fetch with certificate error handling
        const fetchOptions = {
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
            let responseBody;
            try {
                responseBody = JSON.parse(responseText);
            }
            catch {
                responseBody = responseText;
            }
            // Log HTTP response (only if verbose is enabled)
            this.logger.debug(`HTTP Response: ${response.status} ${response.statusText}`);
            if (this.logger.verbose && responseBody) {
                this.logger.debug(`Response body: ${JSON.stringify(responseBody, null, 2)}`);
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}: ${JSON.stringify(responseBody)}`);
            }
            return responseBody;
        }
        catch (error) {
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
    async get(path) {
        return this.request('GET', path);
    }
    /**
     * POST request
     */
    async post(path, body) {
        return this.request('POST', path, body);
    }
    /**
     * DELETE request
     */
    async delete(path) {
        return this.request('DELETE', path);
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=http-client.js.map