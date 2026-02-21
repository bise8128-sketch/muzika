/**
 * Base custom error class for the Muzika application.
 * All domain-specific errors should extend this class.
 */
export class AppError extends Error {
  /**
   * @param message User-friendly or developer-facing error message
   * @param code A unique string identifier for the error type (e.g. 'ERR_AUDIO_DECODE')
   * @param isRecoverable Whether the application can gracefully recover from this error
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly isRecoverable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
