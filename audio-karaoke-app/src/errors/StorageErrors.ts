import { AppError } from './BaseError';

export class StorageQuotaError extends AppError {
  constructor(message: string = 'Insufficient device storage available.', isRecoverable: boolean = true) {
    super(message, 'ERR_STORAGE_QUOTA', isRecoverable);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, isRecoverable: boolean = false) {
    super(message, 'ERR_DATABASE', isRecoverable);
  }
}

export class FileValidationError extends AppError {
  constructor(message: string, isRecoverable: boolean = true) {
    super(message, 'ERR_FILE_VALIDATION', isRecoverable);
  }
}
