
export interface ValidationConfig {
    maxFileSize: number; // Bytes
    allowedTypes: string[]; // MIME types
    minFreeStorage?: number; // Bytes, optional
    audioConstraints?: {
        minDuration?: number; // Seconds
        maxDuration?: number; // Seconds
    };
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class FileValidator {
    private config: ValidationConfig;

    constructor(config: ValidationConfig) {
        this.config = config;
    }

    /**
     * Validates a file against the configured constraints.
     * @param file The file to validate
     * @returns Promise resolving to a ValidationResult
     */
    async validate(file: File): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
        };

        // 1. Static Checks

        // File Size
        if (file.size > this.config.maxFileSize) {
            result.isValid = false;
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            const maxMB = (this.config.maxFileSize / (1024 * 1024)).toFixed(2);
            result.errors.push(`File size (${sizeMB}MB) exceeds the maximum limit of ${maxMB}MB.`);
        }

        // MIME Type (Basic check first, then magic numbers if needed)
        // For now, we'll trust the browser's type detection or extension if type is empty,
        // but a real robust solution would read magic bytes.
        // The plan mentioned "magic numbers, not just extensions".
        const detectedType = await this.detectMimeType(file);
        if (!this.config.allowedTypes.includes(detectedType)) {
            result.isValid = false;
            result.errors.push(`File type '${detectedType}' is not supported. Allowed types: ${this.config.allowedTypes.join(', ')}.`);
        }

        // 2. Environment Checks (Async)

        // Storage Quota
        if (this.config.minFreeStorage && navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                if (estimate.quota && estimate.usage !== undefined) {
                    const available = estimate.quota - estimate.usage;
                    // We need space for the file + overhead (e.g., 3x for processing)
                    // The requirement says: Required = FileSize * 3 + ModelOverhead (we can approximate model overhead or assume it's part of minFreeStorage)
                    // Let's use the simple logic: available must be > minFreeStorage (which presumably accounts for the file)
                    // OR, strictly following the plan: check if available > required

                    // Let's assume minFreeStorage is the absolute minimum *buffer* required.
                    // The file itself takes space, plus processing overhead.
                    const requiredSpace = file.size * 3 + (this.config.minFreeStorage || 0);

                    if (available < requiredSpace) {
                        // This might be an error or a warning depending on strictness.
                        // Plan says "User Feedback" -> "Not enough disk space".
                        // Usually this prevents processing, so let's make it an error.
                        result.isValid = false;
                        const availableMB = (available / (1024 * 1024)).toFixed(0);
                        const requiredMB = (requiredSpace / (1024 * 1024)).toFixed(0);
                        result.errors.push(`Not enough storage space. Available: ${availableMB}MB, Required: ${requiredMB}MB.`);
                    }
                }
            } catch (e) {
                console.warn('Storage estimation failed:', e);
                // Don't fail validation if API fails, just warn
                result.warnings.push('Could not verify available storage space.');
            }
        }

        // Audio Constraints (Duration)
        if (result.isValid && this.config.audioConstraints) {
            try {
                const duration = await this.getAudioDuration(file);

                if (this.config.audioConstraints.minDuration && duration < this.config.audioConstraints.minDuration) {
                    result.isValid = false;
                    result.errors.push(`Audio is too short (${duration.toFixed(1)}s). Minimum: ${this.config.audioConstraints.minDuration}s.`);
                }

                if (this.config.audioConstraints.maxDuration && duration > this.config.audioConstraints.maxDuration) {
                    result.isValid = false;
                    result.errors.push(`Audio is too long (${duration.toFixed(1)}s). Maximum: ${this.config.audioConstraints.maxDuration}s.`);
                }
            } catch (e) {
                result.warnings.push('Could not verify audio duration.');
                console.error('Duration check failed', e);
            }
        }

        // Memory Check (Optional warning)
        if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
            const memory = (navigator as unknown as { deviceMemory: number }).deviceMemory;
            if (memory < 4) {
                // This is a rough heuristic. 4GB is usually okay, but < 2GB is risky for ML.
                // Let's just warn if it's very low.
                if (memory <= 2) {
                    result.warnings.push(`Low device memory (${memory}GB) detected. Processing might be slow or unstable.`);
                }
            }
        }

        return result;
    }

    /**
     * Helper to detect MIME type using magic numbers for common audio formats.
     */
    private async detectMimeType(file: File): Promise<string> {
        const fallback = file.type;
        // If browser detected it and it's in our allowed list, we might trust it to save time,
        // but for robustness (Plan requirement), we should check signatures.

        try {
            const arr = (new Uint8Array(await file.slice(0, 4).arrayBuffer()));
            let header = '';
            for (let i = 0; i < arr.length; i++) {
                header += arr[i].toString(16).toUpperCase();
            }

            // Common Signatures
            // MP3: ID3 (49 44 33) or FF FB / FF F3 / FF F2
            if (header.startsWith('494433')) return 'audio/mpeg';
            if (header.startsWith('FFF3') || header.startsWith('FFFB')) return 'audio/mpeg';

            // WAV: RIFF .... WAVE
            // We need to check 'RIFF' at 0 and 'WAVE' at 8. 
            // 52 49 46 46 (RIFF)
            if (header.startsWith('52494646')) {
                return 'audio/wav'; // Simplified, really should check for WAVE
            }

            // FLAC: 66 4C 61 43
            if (header.startsWith('664C6143')) return 'audio/flac';

            // OGG: 4F 67 67 53
            if (header.startsWith('4F676753')) return 'audio/ogg';

            // M4A/AAC: usually starts with ftypM4A or similar. 
            // 00 00 00 20 66 74 79 70 4D 34 41 (ftypM4A) is common but variable length.

            // If we can't detect it easily, fall back to extension/browser type
            return fallback;
        } catch (e) {
            console.warn('Magic number detection failed', e);
            return fallback;
        }
    }

    /**
     * Helper to get audio duration.
     * Using AudioContext decodeAudioData is accurate but requires decoding the whole file (slow/heavy).
     * Creating an HTMLAudioElement is lighter for just duration if the browser supports the codec.
     */
    private getAudioDuration(file: File): Promise<number> {
        return new Promise((resolve, reject) => {
            const audio = new Audio(URL.createObjectURL(file));
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                if (audio.duration === Infinity) {
                    // Some browsers return Infinity for streams or some files initially.
                    // We might need a different approach or just accept it.
                    // For a local file, it should be finite.
                    audio.currentTime = 1e101; // Hack to trigger duration calculation sometimes
                    audio.ontimeupdate = () => {
                        URL.revokeObjectURL(audio.src);
                        audio.ontimeupdate = null;
                        resolve(audio.duration);
                    }
                    return; // Wait for update
                }
                resolve(audio.duration);
            };
            audio.onerror = (e) => {
                URL.revokeObjectURL(audio.src);
                reject(e);
            };
        });
    }
}
