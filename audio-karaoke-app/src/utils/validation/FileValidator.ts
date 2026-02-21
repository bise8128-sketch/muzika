
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

        // MIME Type
        const detectedType = await this.detectMimeType(file);
        if (!this.config.allowedTypes.includes(detectedType)) {
            result.isValid = false;
            result.errors.push(`File type '${detectedType}' is not supported. Allowed types: ${this.config.allowedTypes.join(', ')}.`);
        } else if (!this.isCodecSupported(detectedType)) {
            result.isValid = false;
            result.errors.push(`MIME type '${detectedType}' is technically allowed but not supported by your browser's audio engine.`);
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
        try {
            const buffer = await file.slice(0, 12).arrayBuffer();
            const arr = new Uint8Array(buffer);
            
            // Convert to hex string for easier matching
            const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

            // 1. MP3 (standard or ID3v2)
            if (hex.startsWith('494433')) return 'audio/mpeg'; // ID3v2
            if (hex.startsWith('FFFB') || hex.startsWith('FFF3') || hex.startsWith('FFF2')) return 'audio/mpeg'; // Standard frames

            // 2. WAV (RIFF header)
            // Starts with "RIFF", bytes 8-11 should be "WAVE"
            // "RIFF" = 52 49 46 46
            // "WAVE" = 57 41 56 45
            if (hex.startsWith('52494646') && hex.slice(16, 24) === '57415645') return 'audio/wav';

            // 3. FLAC
            // "fLaC" = 66 4C 61 43
            if (hex.startsWith('664C6143')) return 'audio/flac';

            // 4. OGG (Vorbis/Opus)
            // "OggS" = 4F 67 67 53
            if (hex.startsWith('4F676753')) return 'audio/ogg';

            // 5. M4A / MP4 Audio
            // Starts with "ftypM4A" (at offset 4 usually)
            // "ftyp" = 66 74 79 70
            // "M4A " = 4D 34 41 20
            if (hex.slice(8, 16) === '66747970' && hex.slice(16, 24) === '4D344120') return 'audio/mp4';

            // 6. AAC (ADTS)
            // Starts with FF F1 or FF F9
            if (hex.startsWith('FFF1') || hex.startsWith('FFF9')) return 'audio/aac';

            return fallback;
        } catch (e) {
            console.warn('Magic number detection failed', e);
            return fallback;
        }
    }

    /**
     * Check if the browser actually supports decoding this MIME type.
     */
    public isCodecSupported(mimeType: string): boolean {
        if (typeof window === 'undefined') return true; // Server-side or generic check
        
        // Use standard Audio element to check support
        const audio = document.createElement('audio');
        const support = audio.canPlayType(mimeType);
        return support === 'probably' || support === 'maybe';
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
