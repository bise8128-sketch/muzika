/**
 * Typed API client for the Muzika application.
 *
 * Wraps `circuitBreakerFetch` with typed methods, automatic JSON
 * serialization, AbortController support, and optional retry logic.
 */

import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';
import { RetryHandler } from '@/utils/reliability/RetryHandler';
import type {
  StatusResponse,
  ProcessingRequest,
  ProcessingResponse,
  JobStatusResponse,
  ModelsResponse,
  LibraryResponse,
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
    const mergedOptions: RequestInit = {
      ...options,
      signal: signal ?? options?.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    };

    const execute = async () => {
      const response = await circuitBreakerFetch(url, mergedOptions);

      if (!response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          // ignore parse failure
        }
        throw new ApiError(
          (body as any)?.error || `Request failed with status ${response.status}`,
          response.status,
          body,
        );
      }

      return response.json() as Promise<T>;
    };

    if (this.config.retryEnabled) {
      return this.retryHandler.execute(execute, {
        shouldRetry: (error) => {
          // Only retry on network / 5xx errors, not 4xx
          if (error instanceof ApiError) return error.status >= 500;
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
}

// Singleton instance for convenience
export const apiClient = new ApiClient();
