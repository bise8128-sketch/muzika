import { ModelInfo } from '@/types/model';

/**
 * Shared API request/response types for the Muzika API client.
 */

// --- Status ---

export interface StatusResponse {
  status: 'ready' | 'loading' | 'error';
  services: {
    modelRepository: 'connected' | 'disconnected';
    pythonService?: 'connected' | 'disconnected';
    [key: string]: string | undefined;
  };
}

// --- Processing ---

export interface ProcessingRequest {
  url?: string;
  filename?: string;
  model: string;
  format: string;
}

export interface ProcessingResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed';
}

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'error' | 'queued';
  error?: string;
  logs?: string;
  stems?: Record<string, string>;
  original?: string;
  filename?: string;
}

// --- Models ---

export interface ModelStatus {
  name: string;
  status: 'ready' | 'downloading' | 'error';
  progress?: number;
}

export interface ModelsResponse {
  models: ModelInfo[];
  availableModels: string[];
}

// --- Library ---

export interface SongEntry {
  filename: string;
  path: string;
  stems: Record<string, string>;
}

export interface LibraryResponse {
  songs: SongEntry[];
}

// --- Upload ---

export interface UploadResponse {
  filename: string;
  path: string;
  id: string;
}

// --- Errors ---

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    public readonly url?: string,
    public readonly method?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
