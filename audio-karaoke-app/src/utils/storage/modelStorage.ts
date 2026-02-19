/**
 * Model storage utilities for saving/loading ONNX models in IndexedDB
 */

import { db } from './audioDatabase';
import { ModelType, type ModelInfo, type ModelStorageData } from '@/types/model';
import type { StorageStats, StorageQuota } from '@/types/storage';

/**
 * Check if we're in a browser context with required APIs
 */
function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

export class ModelStorage {
    /**
     * Save an ONNX model to IndexedDB
     */
    async saveModel(modelInfo: ModelInfo, modelData: ArrayBuffer): Promise<number> {
        if (!isBrowser()) {
            console.warn('[ModelStorage] saveModel called during SSR - skipping');
            return -1;
        }

        const storageData: ModelStorageData = {
            modelId: modelInfo.id,
            name: modelInfo.name,
            version: modelInfo.version,
            data: modelData,
            size: modelData.byteLength,
            downloadedAt: Date.now(),
        };

        // Check if model already exists
        const existing = await db.models.where('modelId').equals(modelInfo.id).first();

        if (existing) {
            // Update existing model
            await db.models.update(existing.id!, storageData);
            console.log(`✅ Updated model ${modelInfo.name} (${this.formatSize(modelData.byteLength)})`);
            return existing.id!;
        } else {
            // Add new model
            const id = await db.models.add(storageData);
            console.log(`✅ Saved model ${modelInfo.name} (${this.formatSize(modelData.byteLength)})`);
            return id;
        }
    }

    /**
     * Retrieve a cached model from IndexedDB
     */
    async getModel(modelId: string): Promise<ArrayBuffer | null> {
        if (!isBrowser()) return null;

        const model = await db.models.where('modelId').equals(modelId).first();
        return model ? model.data : null;
    }

    /**
     * Get model metadata
     */
    async getModelInfo(modelId: string): Promise<ModelStorageData | undefined> {
        if (!isBrowser()) return undefined;

        return await db.models.where('modelId').equals(modelId).first();
    }

    /**
     * Delete a model from IndexedDB
     */
    async deleteModel(modelId: string): Promise<void> {
        if (!isBrowser()) return;

        await db.models.where('modelId').equals(modelId).delete();
        console.log(`❌ Deleted model ${modelId}`);
    }

    /**
     * Get all stored models
     */
    async getAllModels(): Promise<ModelInfo[]> {
        if (!isBrowser()) return [];

        const models = await db.models.toArray();
        return models.map(model => ({
            id: model.modelId,
            type: ModelType.MDX, // Default type or determine from modelId
            name: model.name,
            version: model.version,
            size: model.size,
            downloadedAt: model.downloadedAt,
        }));
    }

    /**
     * Check if a model exists in cache
     */
    async modelExists(modelId: string): Promise<boolean> {
        if (!isBrowser()) return false;

        const count = await db.models.where('modelId').equals(modelId).count();
        return count > 0;
    }

    /**
     * Clear all models (cache cleanup)
     */
    async clearAllModels(): Promise<void> {
        if (!isBrowser()) return;

        const count = await db.models.count();
        await db.models.clear();
        console.log(`❌ Cleared ${count} models from cache`);
    }

    /**
     * Export model (for backup)
     */
    async exportModel(modelId: string): Promise<Blob> {
        if (!isBrowser()) {
            throw new Error('exportModel is not available during SSR');
        }

        const model = await this.getModel(modelId);
        if (!model) throw new Error(`Model ${modelId} not found`);

        return new Blob([model], { type: 'application/octet-stream' });
    }

    /**
     * Import model (from backup)
     * Note: This requires adhering to a naming convention or passing metadata separately
     * For now, simplified implementation
     */
    async importModel(file: File, modelInfo: ModelInfo): Promise<number> {
        const arrayBuffer = await file.arrayBuffer();
        return this.saveModel(modelInfo, arrayBuffer);
    }

    /**
     * Get storage statistics
     */
    async getStorageStats(): Promise<StorageStats> {
        if (!isBrowser()) {
            return {
                totalSize: 0,
                modelsSize: 0,
                audioSize: 0,
                quota: { usage: 0, quota: 0, percentage: 0 },
                cachedAudioCount: 0,
                cachedModelsCount: 0,
            };
        }

        const models = await db.models.toArray();
        const audio = await db.cachedAudio.toArray();

        let modelsSize = 0;
        let audioSize = 0;

        models.forEach(model => {
            modelsSize += model.size;
        });

        audio.forEach(item => {
            audioSize += item.vocals.byteLength + item.instrumentals.byteLength;
        });

        const totalSize = modelsSize + audioSize;

        // Get storage quota
        const quota: StorageQuota = {
            usage: 0,
            quota: 0,
            percentage: 0,
        };

        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            quota.usage = estimate.usage || 0;
            quota.quota = estimate.quota || 0;
            quota.percentage = quota.quota > 0 ? (quota.usage / quota.quota) * 100 : 0;
        }

        return {
            totalSize,
            modelsSize,
            audioSize,
            quota,
            cachedAudioCount: audio.length,
            cachedModelsCount: models.length,
        };
    }

    /**
     * LRU eviction policy for models - Remove oldest entries if threshold is exceeded
     */
    async evictOldestIfNeeded(maxModels: number = 5, maxSizeGB: number = 2): Promise<void> {
        if (!isBrowser()) return;

        try {
            const models = await db.models.orderBy('downloadedAt').toArray();
            const stats = await this.getStorageStats();
            
            let currentCount = models.length;
            let currentSizeGB = stats.modelsSize / (1024 * 1024 * 1024);

            if (currentCount <= maxModels && currentSizeGB <= maxSizeGB) return;

            console.log(`[ModelStorage] Threshold reached. Count: ${currentCount}/${maxModels}, Size: ${currentSizeGB.toFixed(2)}GB/${maxSizeGB}GB. Evicting oldest models...`);

            // Evict until both sensors are happy
            for (const model of models) {
                if (currentCount <= maxModels && currentSizeGB <= maxSizeGB) break;

                await this.deleteModel(model.modelId);
                currentCount--;
                currentSizeGB -= (model.size / (1024 * 1024 * 1024));
                console.log(`[ModelStorage] Evicted model: ${model.name}`);
            }
        } catch (error) {
            console.error('[ModelStorage] Eviction failed:', error);
        }
    }

    private formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export const modelStorage = new ModelStorage();

