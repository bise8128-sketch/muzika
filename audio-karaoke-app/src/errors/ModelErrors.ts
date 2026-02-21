import { AppError } from './BaseError';

export class ModelLoadError extends AppError {
  constructor(message: string, isRecoverable: boolean = true) {
    super(message, 'ERR_MODEL_LOAD', isRecoverable);
  }
}

export class ModelInferenceError extends AppError {
  constructor(message: string, isRecoverable: boolean = false) {
    super(message, 'ERR_MODEL_INFERENCE', isRecoverable);
  }
}

export class SeparationError extends AppError {
  constructor(message: string, isRecoverable: boolean = false) {
    super(message, 'ERR_SEPARATION_FAILED', isRecoverable);
  }
}
