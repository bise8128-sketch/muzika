import { AppError } from './BaseError';

export class NetworkFetchError extends AppError {
  /**
   * @param message Error description
   * @param statusCode Optional HTTP status code from the failed request
   * @param isRecoverable Defaults to true since network issues are often transient
   */
  constructor(
    message: string,
    public readonly statusCode?: number,
    isRecoverable: boolean = true
  ) {
    super(message, 'ERR_NETWORK_FETCH', isRecoverable);
  }
}

export class ApiRateLimitError extends AppError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 'ERR_API_RATE_LIMIT', true);
  }
}
