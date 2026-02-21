import { AppError } from './BaseError';

export class AudioProcessingError extends AppError {
  constructor(message: string, isRecoverable: boolean = false) {
    super(message, 'ERR_AUDIO_PROCESSING', isRecoverable);
  }
}

export class AudioContextError extends AppError {
  constructor(message: string, isRecoverable: boolean = true) {
    super(message, 'ERR_AUDIO_CONTEXT', isRecoverable);
  }
}

export class AudioDecodingError extends AppError {
  constructor(message: string, isRecoverable: boolean = false) {
    super(message, 'ERR_AUDIO_DECODE', isRecoverable);
  }
}

export class MediaDeviceError extends AppError {
  constructor(message: string, isRecoverable: boolean = true) {
    super(message, 'ERR_MEDIA_DEVICE', isRecoverable);
  }
}
