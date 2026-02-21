import { ApiClient } from '../ApiClient';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';
import { logError } from '@/lib/monitoring';
import { ApiError } from '../types';

jest.mock('@/utils/api/circuitBreakerFetch');
jest.mock('@/lib/monitoring');

const mockFetch = circuitBreakerFetch as jest.Mock;
const mockLogError = logError as jest.Mock;

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ApiClient({ baseUrl: 'https://api.test' });
  });

  it('performs standard GET request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ready' }),
    });

    const result = await client.getStatus();
    expect(result.status).toBe('ready');
    expect(mockFetch).toHaveBeenCalledWith('https://api.test/api/status', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('performs POST request with body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobId: '123' }),
    });

    const result = await client.startProcessing({ model: 'htdemucs', format: 'mp3' });
    expect(result.jobId).toBe('123');
    expect(mockFetch).toHaveBeenCalledWith('https://api.test/api/python-processing', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ model: 'htdemucs', format: 'mp3' }),
    }));
  });

  it('handles and logs 500 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server exploded' }),
    });

    await expect(client.getStatus()).rejects.toThrow('Server exploded');
    expect(mockLogError).toHaveBeenCalled();
  });

  it('handles network failures and logs 0 status', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    await expect(client.getStatus()).rejects.toThrow(ApiError);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 0 }),
      expect.any(Object)
    );
  });

  it('handles file uploads with FormData', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ filename: 'test.mp3' }),
    });

    const file = new File([''], 'test.mp3', { type: 'audio/mpeg' });
    const result = await client.uploadFile(file);

    expect(result.filename).toBe('test.mp3');
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.test/api/backend-upload');
    expect(callArgs[1].body).toBeInstanceOf(FormData);
    // Should NOT have Content-Type header manually set (browser handles it for FormData)
    expect(callArgs[1].headers['Content-Type']).toBeUndefined();
  });
});
