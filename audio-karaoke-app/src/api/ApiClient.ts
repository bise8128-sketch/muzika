/**
 * Typed API client for the Muzika application.
 *
 * Wraps `circuitBreakerFetch` with typed methods, automatic JSON
 * serialization, AbortController support, and optional retry logic.
 */

import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';
import { RetryHandler } from '@/utils/reliability/RetryHandler';
import { logError } from '@/lib/monitoring';
import type {
  StatusResponse,
  ProcessingRequest,
  ProcessingResponse,
  JobStatusResponse,
  ModelsResponse,
  LibraryResponse,
  UploadResponse,
} from './types';
import { ApiError } from './types';

export interface ApiClientConfig {
  baseUrl?: string;
  retryEnabled?: boolean;
  maxRetries?: number;
  baseRetryDelay?: number;
}

const DEFAULT_CONFIG: ApiClientConfig = {
  baseUrl: '',
  retryEnabled: false,
  maxRetries: 2,
  baseRetryDelay: 1000,
};

export class ApiClient {
  private config: Required<ApiClientConfig>;
  private retryHandler: RetryHandler;

  constructor(config?: ApiClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<ApiClientConfig>;
    this.retryHandler = new RetryHandler(this.config.maxRetries, this.config.baseRetryDelay);
  }

  // ---- Internal helpers ----

  private async request<T>(
    path: string,
    options?: RequestInit,
    signal?: AbortSignal,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const method = options?.method || 'GET';
    const mergedOptions: RequestInit = {
      ...options,
      signal: signal ?? options?.signal,
      headers: {
        ...(!(options?.body instanceof FormData) && { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
    };

    const execute = async () => {
      try {
        const response = await circuitBreakerFetch(url, mergedOptions);

        if (!response.ok) {
          let body: unknown;
          try {
            body = await response.json();
          } catch {
            // ignore parse failure
          }
          const error = new ApiError(
            (body as any)?.error || `Request failed with status ${response.status}`,
            response.status,
            body,
            url,
            method
          );
          
          // Log high-severity errors to monitoring
          if (response.status >= 500 || response.status === 429) {
            logError(error, { url, method, status: response.status });
          }
          
          throw error;
        }

        return response.json() as Promise<T>;
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        
        // Wrap network errors
        if (!(error instanceof ApiError)) {
          const apiError = new ApiError(
            error.message || 'Network request failed',
            0,
            undefined,
            url,
            method
          );
          logError(apiError, { url, method, originalError: error.message });
          throw apiError;
        }
        throw error;
      }
    };

    if (this.config.retryEnabled) {
      return this.retryHandler.execute(execute, {
        shouldRetry: (error) => {
          if (error instanceof ApiError) {
            // Retry on 5xx or circuit open (status 0 but not network abort)
            return error.status >= 500 || error.status === 0;
          }
          return true; // network errors
        },
      });
    }

    return execute();
  }

  // ---- Public API methods ----

  /** Check backend health / status */
  async getStatus(signal?: AbortSignal): Promise<StatusResponse> {
    return this.request<StatusResponse>('/api/status', { method: 'GET' }, signal);
  }

  /** Start a server-side processing job */
  async startProcessing(
    data: ProcessingRequest,
    signal?: AbortSignal,
  ): Promise<ProcessingResponse> {
    return this.request<ProcessingResponse>(
      '/api/python-processing',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      signal,
    );
  }

  /** Poll for the status of a processing job */
  async getJobStatus(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(
      `/api/python-processing?jobId=${encodeURIComponent(jobId)}`,
      { method: 'GET' },
      signal,
    );
  }

  /** Fetch available models */
  async getModels(signal?: AbortSignal): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('/api/models', { method: 'GET' }, signal);
  }

  /** Fetch server library */
  async getLibrary(signal?: AbortSignal): Promise<LibraryResponse> {
    return this.request<LibraryResponse>('/api/backend-library', { method: 'GET' }, signal);
  }

  /** Upload a file for processing */
  async uploadFile(
    file: File | Blob,
    filename?: string,
    signal?: AbortSignal
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file, filename || (file as File).name);
    
    return this.request<UploadResponse>(
      '/api/backend-upload',
      {
        method: 'POST',
        body: formData,
      },
      signal
    );
  }
}

// Singleton instance for convenience
export const apiClient = new ApiClient();
