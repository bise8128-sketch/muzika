/**
 * Model storage utilities for saving/loading ONNX models in IndexedDB
 */

import { db } from './audioDatabase';
import type { ModelInfo, ModelStorageData } from '@/types/model';
import type { StorageStats, StorageQuota } from '@/types/storage';

/**
 * Save an ONNX model to IndexedDB
 */
export async function saveModel(modelInfo: ModelInfo, modelData: ArrayBuffer): Promise<void> {
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
    } else {
        // Add new model
        await db.models.add(storageData);
    }
}

/**
 * Retrieve a cached model from IndexedDB
 */
export async function getModel(modelId: string): Promise<ArrayBuffer | null> {
    const model = await db.models.where('modelId').equals(modelId).first();
    return model ? model.data : null;
}

/**
 * Delete a model from IndexedDB
 */
export async function deleteModel(modelId: string): Promise<void> {
    await db.models.where('modelId').equals(modelId).delete();
}

/**
 * Get all stored models
 */
export async function getAllModels(): Promise<ModelInfo[]> {
    const models = await db.models.toArray();
    return models.map(model => ({
        id: model.modelId,
        name: model.name,
        version: model.version,
        size: model.size,
        downloadedAt: model.downloadedAt,
    }));
}

/**
 * Check if a model exists in cache
 */
export async function modelExists(modelId: string): Promise<boolean> {
    const count = await db.models.where('modelId').equals(modelId).count();
    return count > 0;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
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
    let quota: StorageQuota = {
        usage: 0,
        quota: 0,
        percentage: 0,
    };

    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        quota = {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
        };
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
