import { FileValidator, ValidationConfig, ValidationResult as FileValidationResult } from './FileValidator';
import { StorageQuotaService, QuotaCheckResult } from './StorageQuotaService';

export interface TelemetryEvent {
    type: 'validation_error' | 'validation_warning' | 'quota_error' | 'sanitization_event';
    component: string;
    details: Record<string, unknown>;
    timestamp: number;
}

export interface ValidationServiceResult {
    isValid: boolean;
    sanitizedFile?: File;
    errors: string[];
    warnings: string[];
    telemetryEvents: TelemetryEvent[];
}

export class ValidationService {
    private static instance: ValidationService;
    private fileValidator: FileValidator;

    private constructor() {
        // Default configuration
        const config: ValidationConfig = {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/flac', 'audio/ogg', 'audio/m4a'],
            minFreeStorage: 200 * 1024 * 1024, // Optional legacy checking, we use StorageQuotaService directly now
            audioConstraints: {
                minDuration: 1, // 1 second
                maxDuration: 1200, // 20 minutes
            }
        };
        this.fileValidator = new FileValidator(config);
    }

    public static getInstance(): ValidationService {
        if (!ValidationService.instance) {
            ValidationService.instance = new ValidationService();
        }
        return ValidationService.instance;
    }

    /**
     * Centralized pipeline to validate and sanitize an audio file.
     * @param file The uploaded file
     * @param component Name of the component requesting validation (for telemetry)
     */
    async validateAudioFile(file: File, component: string = 'ValidationService'): Promise<ValidationServiceResult> {
        const result: ValidationServiceResult = {
            isValid: true,
            errors: [],
            warnings: [],
            telemetryEvents: []
        };

        try {
            // 1. Sanitize filename
            const sanitizedName = this.sanitizeFilename(file.name);
            let processedFile = file;

            if (sanitizedName !== file.name) {
                // Rename file with sanitized name
                processedFile = new File([file], sanitizedName, { type: file.type });
                result.telemetryEvents.push({
                    type: 'sanitization_event',
                    component,
                    details: { original: file.name, sanitized: sanitizedName },
                    timestamp: Date.now()
                });
            }

            result.sanitizedFile = processedFile;

            // 2. Format and Metadata Validation (FileValidator)
            const formatCheck = await this.fileValidator.validate(processedFile);
            if (!formatCheck.isValid) {
                result.isValid = false;
                result.errors.push(...formatCheck.errors);
                result.warnings.push(...formatCheck.warnings);

                result.telemetryEvents.push({
                    type: 'validation_error',
                    component,
                    details: { errors: formatCheck.errors, filename: sanitizedName },
                    timestamp: Date.now()
                });
                return result; // Early return on format failure
            }

            // 3. Storage Quota Validation
            const quotaCheck = await StorageQuotaService.canProcessAudio(processedFile.size);
            if (!quotaCheck.hasEnoughSpace) {
                result.isValid = false;
                const availableMB = (quotaCheck.availableSpace / (1024 * 1024)).toFixed(0);
                const requiredMB = (quotaCheck.requiredSpace / (1024 * 1024)).toFixed(0);
                const msg = `Insufficient storage space. Available: ${availableMB}MB, Required: ${requiredMB}MB.`;
                result.errors.push(msg);

                result.telemetryEvents.push({
                    type: 'quota_error',
                    component,
                    details: { available: quotaCheck.availableSpace, required: quotaCheck.requiredSpace, filename: sanitizedName },
                    timestamp: Date.now()
                });
                return result;
            }

            if (formatCheck.warnings.length > 0) {
                result.warnings.push(...formatCheck.warnings);
                result.telemetryEvents.push({
                    type: 'validation_warning',
                    component,
                    details: { warnings: formatCheck.warnings, filename: sanitizedName },
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            const err = error as Error;
            result.isValid = false;
            result.errors.push(err.message || 'Unknown validation error occurred.');
            result.telemetryEvents.push({
                type: 'validation_error',
                component,
                details: { error: err.message || String(error) },
                timestamp: Date.now()
            });
        }

        return result;
    }

    /**
     * Validates if a model can be downloaded.
     */
    async validateModelDownload(modelId: string, estimatedSize: number, component: string = 'ValidationService'): Promise<ValidationServiceResult> {
        const result: ValidationServiceResult = {
            isValid: true,
            errors: [],
            warnings: [],
            telemetryEvents: []
        };

        const quotaCheck = await StorageQuotaService.canDownloadModel(estimatedSize);
        if (!quotaCheck.hasEnoughSpace) {
            result.isValid = false;
            const msg = `Not enough storage space to download model. Need ${(quotaCheck.requiredSpace / (1024 * 1024)).toFixed(0)}MB.`;
            result.errors.push(msg);

            result.telemetryEvents.push({
                type: 'quota_error',
                component,
                details: { modelId, required: quotaCheck.requiredSpace, available: quotaCheck.availableSpace },
                timestamp: Date.now()
            });
        }

        return result;
    }

    /**
     * Utility to sanitize filenames to prevent injection and avoid path issues.
     */
    private sanitizeFilename(filename: string): string {
        return filename
            .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid path characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/^[.-]+|[.-]+$/g, '') // Trim dots/dashes from edges
            .slice(0, 255); // Max length
    }
}
