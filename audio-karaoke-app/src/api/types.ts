/**
 * Shared API request/response types for the Muzika API client.
 */

// --- Status ---

export interface StatusResponse {
  status: string;
  services: {
    modelRepository: 'connected' | 'disconnected';
    [key: string]: string;
  };
}

// --- Processing ---

export interface ProcessingRequest {
  url: string;
  model: string;
  format: string;
}

export interface ProcessingResponse {
  jobId: string;
}

export interface JobStatusResponse {
  status: 'processing' | 'completed' | 'error';
  error?: string;
  logs?: string;
  stems?: {
    vocals?: string;
    other?: string;
    drums?: string;
    bass?: string;
  };
  original?: string;
}

// --- Models ---

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  size?: number;
  type?: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
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

// --- Errors ---

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
