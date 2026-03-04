export interface QuotaCheckResult {
    hasEnoughSpace: boolean;
    availableSpace: number;
    requiredSpace: number;
    error?: string;
}

export class StorageQuotaService {
    /**
     * Estimates available storage space using the navigator.storage API.
     * @returns Promise resolving to the available bytes, or undefined if not supported/failed.
     */
    static async getAvailableStorage(): Promise<number | undefined> {
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                if (estimate.quota !== undefined && estimate.usage !== undefined) {
                    return estimate.quota - estimate.usage;
                }
            } catch (error) {
                console.warn('Failed to estimate storage quota:', error);
            }
        }
        return undefined;
    }

    /**
     * Checks if there is enough storage space for a given requirement.
     * @param requiredBytes The number of bytes required.
     * @returns A QuotaCheckResult indicating if enough space is available.
     */
    static async hasEnoughSpace(requiredBytes: number): Promise<QuotaCheckResult> {
        const available = await this.getAvailableStorage();
        
        if (available === undefined) {
            // If we can't estimate, we assume there's enough space rather than blocking the user
            return {
                hasEnoughSpace: true,
                availableSpace: 0,
                requiredSpace: requiredBytes,
                error: 'Storage estimation not supported or failed.',
            };
        }

        return {
            hasEnoughSpace: available >= requiredBytes,
            availableSpace: available,
            requiredSpace: requiredBytes,
        };
    }

    /**
     * Checks if there's enough space for downloading a model.
     * @param modelSizeBytes Size of the model in bytes.
     * @param bufferBytes Extra buffer space required (default 50MB).
     */
    static async canDownloadModel(modelSizeBytes: number, bufferBytes: number = 50 * 1024 * 1024): Promise<QuotaCheckResult> {
        return this.hasEnoughSpace(modelSizeBytes + bufferBytes);
    }

    /**
     * Checks if there's enough space for processing an audio file.
     * Usually processing requires multiple times the original file size (e.g., for stems).
     * @param fileSizeBytes Size of the original audio file.
     * @param multiplier Estimated storage multiplier (default 4 for 4 stems).
     * @param bufferBytes Extra buffer space required (default 100MB).
     */
    static async canProcessAudio(fileSizeBytes: number, multiplier: number = 4, bufferBytes: number = 100 * 1024 * 1024): Promise<QuotaCheckResult> {
        const requiredSpace = (fileSizeBytes * multiplier) + bufferBytes;
        return this.hasEnoughSpace(requiredSpace);
    }
}
