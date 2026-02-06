# IndexedDB & Local Storage Complete Guide

## 1. Zašto IndexedDB?

```
Storage Option | Size Limit | Speed | Use Case
─────────────────────────────────────────────
localStorage   | 5-10 MB   | Fast  | Male konfiguracije
SessionStorage | 5-10 MB   | Fast  | Privremeni podaci
IndexedDB      | 50 GB+    | Brz   | ✅ AI modeli, cache audio
Cache API      | 50 GB+    | Brz   | ✅ HTTP cache
File System    | Unlimited | Brz   | Desktop apps
```

Za našu aplikaciju trebamo IndexedDB jer:
- AI modeli (80-300 MB) ne stanu u localStorage
- Trebamo brz pristup cachiniranim audio rezultatima
- Trebamo strukturirane upite (Find by filename, sort by date, itd.)

---

## 2. Dexie.js Setup (Wrapper oko IndexedDB)

### Instalacija

```bash
npm install dexie
npm install -D @types/dexie
```

### File: `src/utils/storage/audioDatabase.ts`

Dexie je jednostavniji API oko IndexedDB.

```typescript
import Dexie, { Table } from 'dexie';

/**
 * Definiraj tipove podataka koji će se pohraniti
 */
export interface CachedModel {
  id?: number; // Auto-increment primary key
  name: 'mdx-net' | 'demucs' | 'bs-roformer';
  version: string;
  data: ArrayBuffer; // Cijeli model
  size: number; // u bajtovima
  downloadedAt: number; // timestamp
}

export interface CachedAudio {
  id?: number;
  fileHash: string; // SHA-256 od originalne datoteke
  fileName: string;
  fileSizeBytes: number;
  duration: number; // u sekundama
  sampleRate: number;
  vocals: ArrayBuffer; // Obrađeni vocals
  instrumentals: ArrayBuffer; // Obrađeni instrumentals
  processedAt: number; // timestamp
  modelUsed: string; // Koji model je korišten
}

export interface ProcessingLog {
  id?: number;
  fileHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  errorMessage?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Kreiraj Dexie bazu
 */
export class AudioKaraokeDB extends Dexie {
  // Definiraj tablice
  models!: Table<CachedModel>;
  cachedAudio!: Table<CachedAudio>;
  processingLogs!: Table<ProcessingLog>;

  constructor() {
    super('AudioKaraokeDB');

    // Definiraj verziju i schemu
    this.version(1).stores({
      // Format: 'primaryKey, indexedField1, indexedField2'
      models: '++id, name, version',
      cachedAudio: '++id, fileHash, fileName, [fileHash+modelUsed]',
      processingLogs: '++id, fileHash, status, startedAt',
    });
  }
}

// Kreiraj globalnu instancu baze
export const db = new AudioKaraokeDB();
```

---

## 3. Model Management

### File: `src/utils/storage/modelStorage.ts`

```typescript
import { db, CachedModel } from './audioDatabase';

export class ModelStorage {
  /**
   * Spremi model u bazu
   */
  async saveModel(
    name: string,
    version: string,
    modelData: ArrayBuffer
  ): Promise<number> {
    const id = await db.models.add({
      name: name as any,
      version,
      data: modelData,
      size: modelData.byteLength,
      downloadedAt: Date.now(),
    });

    console.log(`✅ Saved model ${name} (${this.formatSize(modelData.byteLength)})`);
    return id;
  }

  /**
   * Preuzmite model iz baze
   */
  async getModel(name: string, version?: string): Promise<CachedModel | null> {
    if (version) {
      return db.models.get({ name: name as any, version });
    }

    // Ako nema verzije, vrati najnoviju
    const model = await db.models
      .where('name')
      .equals(name as any)
      .last();

    return model || null;
  }

  /**
   * Provjeri dostupnost svih modela
   */
  async getAvailableModels(): Promise<Record<string, CachedModel>> {
    const models = await db.models.toArray();
    const result: Record<string, CachedModel> = {};

    for (const model of models) {
      if (!result[model.name] || model.downloadedAt > result[model.name].downloadedAt) {
        result[model.name] = model;
      }
    }

    return result;
  }

  /**
   * Obriši model iz baze
   */
  async deleteModel(name: string, version?: string): Promise<void> {
    if (version) {
      await db.models.delete(
        db.models.where({ name: name as any, version }).first()
      );
    } else {
      await db.models.where('name').equals(name as any).delete();
    }

    console.log(`❌ Deleted model ${name}`);
  }

  /**
   * Obriši sve modele (očisti cache)
   */
  async clearAllModels(): Promise<void> {
    const count = await db.models.count();
    await db.models.clear();
    console.log(`❌ Cleared ${count} models from cache`);
  }

  /**
   * Dobij informacije o korištenju prostora
   */
  async getStorageStats(): Promise<{
    modelCount: number;
    totalSize: number;
    models: Array<{ name: string; size: number }>;
  }> {
    const models = await db.models.toArray();

    const totalSize = models.reduce((sum, m) => sum + m.size, 0);
    const modelList = models.map((m) => ({
      name: m.name,
      size: m.size,
    }));

    return {
      modelCount: models.length,
      totalSize,
      models: modelList,
    };
  }

  /**
   * Eksportuj model (za backup)
   */
  async exportModel(name: string): Promise<Blob> {
    const model = await this.getModel(name);
    if (!model) throw new Error(`Model ${name} not found`);

    return new Blob([model.data], { type: 'application/octet-stream' });
  }

  /**
   * Importuj model (iz backup-a)
   */
  async importModel(file: File): Promise<string> {
    const modelName = file.name.split('.')[0];
    const arrayBuffer = await file.arrayBuffer();

    return this.saveModel(modelName, '1.0', arrayBuffer);
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
```

---

## 4. Audio Cache Management

### File: `src/utils/storage/audioCache.ts`

```typescript
import { db, CachedAudio } from './audioDatabase';
import crypto from 'crypto';

export class AudioCache {
  /**
   * Izračunaj SHA-256 hash datoteke
   */
  async hashFile(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

    // Konvertuj u heksadecimalni string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return hashHex;
  }

  /**
   * Spremi separiran audio u cache
   */
  async cacheAudioResult(
    file: File,
    vocals: ArrayBuffer,
    instrumentals: ArrayBuffer,
    sampleRate: number,
    duration: number,
    modelUsed: string
  ): Promise<void> {
    const fileHash = await this.hashFile(file);

    // Ako već postoji, obriši prije nego spremi novu verziju
    await db.cachedAudio
      .where('fileHash')
      .equals(fileHash)
      .delete();

    await db.cachedAudio.add({
      fileHash,
      fileName: file.name,
      fileSizeBytes: file.size,
      duration,
      sampleRate,
      vocals,
      instrumentals,
      processedAt: Date.now(),
      modelUsed,
    });

    console.log(`✅ Cached audio: ${file.name}`);
  }

  /**
   * Preuzmite cachiran audio
   */
  async getCachedAudio(file: File, modelUsed?: string): Promise<CachedAudio | null> {
    const fileHash = await this.hashFile(file);

    if (modelUsed) {
      // Ako je specificiran model, traži točan match
      return db.cachedAudio.get({ fileHash, modelUsed });
    }

    // Inače vrati bilo koji cachiran audio za tu datoteku
    return db.cachedAudio.where('fileHash').equals(fileHash).first();
  }

  /**
   * Obriši cachiran audio
   */
  async deleteCachedAudio(file: File): Promise<void> {
    const fileHash = await this.hashFile(file);
    await db.cachedAudio.where('fileHash').equals(fileHash).delete();

    console.log(`❌ Deleted cached audio: ${file.name}`);
  }

  /**
   * Obriši sve cachingirane audio datoteke
   */
  async clearAudioCache(): Promise<void> {
    const count = await db.cachedAudio.count();
    await db.cachedAudio.clear();
    console.log(`❌ Cleared ${count} cached audio files`);
  }

  /**
   * Dobij cache statistike
   */
  async getCacheStats(): Promise<{
    totalFiles: number;
    totalSizeGB: number;
    oldestFile: Date | null;
    newestFile: Date | null;
    files: Array<{
      name: string;
      size: number;
      duration: number;
      processedAt: Date;
    }>;
  }> {
    const files = await db.cachedAudio.toArray();

    const totalSizeBytes = files.reduce(
      (sum, f) => sum + f.vocals.byteLength + f.instrumentals.byteLength,
      0
    );

    const oldestFile = files.length > 0
      ? new Date(Math.min(...files.map((f) => f.processedAt)))
      : null;

    const newestFile = files.length > 0
      ? new Date(Math.max(...files.map((f) => f.processedAt)))
      : null;

    const filesList = files.map((f) => ({
      name: f.fileName,
      size: f.vocals.byteLength + f.instrumentals.byteLength,
      duration: f.duration,
      processedAt: new Date(f.processedAt),
    }));

    return {
      totalFiles: files.length,
      totalSizeGB: totalSizeBytes / (1024 * 1024 * 1024),
      oldestFile,
      newestFile,
      files: filesList,
    };
  }

  /**
   * Očisti cache ako je premali prostor
   * (LRU - Least Recently Used strategy)
   */
  async evictOldestIfNeeded(maxSizeGB: number = 1): Promise<void> {
    const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;

    // Dobij sve datoteke sortirane po datumu
    const files = await db.cachedAudio
      .orderBy('processedAt')
      .toArray();

    let currentSize = 0;
    const filesToDelete: string[] = [];

    // Kreni od najnovijih (unazad)
    for (let i = files.length - 1; i >= 0; i--) {
      const file = files[i];
      const fileSize = file.vocals.byteLength + file.instrumentals.byteLength;
      currentSize += fileSize;

      if (currentSize > maxSizeBytes) {
        filesToDelete.push(file.fileHash);
      }
    }

    // Obriši stare datoteke
    for (const hash of filesToDelete) {
      await db.cachedAudio.where('fileHash').equals(hash).delete();
      console.log(`🗑️  Evicted old cache entry: ${hash.substring(0, 8)}...`);
    }
  }
}

export const audioCache = new AudioCache();
```

---

## 5. Processing Logs

### File: `src/utils/storage/processingLogs.ts`

```typescript
import { db } from './audioDatabase';

export class ProcessingLogger {
  /**
   * Kreiraj log za novi processing job
   */
  async startProcessing(fileHash: string): Promise<number> {
    const id = await db.processingLogs.add({
      fileHash,
      status: 'processing',
      progress: 0,
      startedAt: Date.now(),
    });

    return id;
  }

  /**
   * Ažuriraj progress
   */
  async updateProgress(logId: number, progress: number): Promise<void> {
    await db.processingLogs.update(logId, {
      progress: Math.min(100, progress),
    });
  }

  /**
   * Označi kao kompletno
   */
  async markComplete(logId: number): Promise<void> {
    await db.processingLogs.update(logId, {
      status: 'completed',
      progress: 100,
      completedAt: Date.now(),
    });
  }

  /**
   * Označi kao failed
   */
  async markFailed(logId: number, error: string): Promise<void> {
    await db.processingLogs.update(logId, {
      status: 'failed',
      errorMessage: error,
      completedAt: Date.now(),
    });
  }

  /**
   * Dobij log
   */
  async getLog(logId: number) {
    return db.processingLogs.get(logId);
  }

  /**
   * Dobij sve logove za datoteku
   */
  async getLogsForFile(fileHash: string) {
    return db.processingLogs.where('fileHash').equals(fileHash).toArray();
  }

  /**
   * Obriši stare logove (starije od N dana)
   */
  async deleteLogs(olderThanDays: number = 30): Promise<void> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    await db.processingLogs
      .where('startedAt')
      .below(cutoffTime)
      .delete();

    console.log(`🗑️  Deleted logs older than ${olderThanDays} days`);
  }
}

export const processingLogger = new ProcessingLogger();
```

---

## 6. React Hook za Storage

### File: `src/hooks/useAudioCache.ts`

```typescript
import { useEffect, useState } from 'react';
import { audioCache } from '@/utils/storage/audioCache';

export function useAudioCache() {
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Učitaj statistike na mount-u
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const stats = await audioCache.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  };

  const getCachedAudio = async (file: File) => {
    setIsLoading(true);
    try {
      const cached = await audioCache.getCachedAudio(file);
      return cached;
    } finally {
      setIsLoading(false);
    }
  };

  const cacheSeparationResult = async (
    file: File,
    vocals: ArrayBuffer,
    instrumentals: ArrayBuffer,
    sampleRate: number,
    duration: number,
    modelUsed: string
  ) => {
    setIsLoading(true);
    try {
      await audioCache.cacheAudioResult(
        file,
        vocals,
        instrumentals,
        sampleRate,
        duration,
        modelUsed
      );
      await loadStats(); // Osvježi statistike
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    setIsLoading(true);
    try {
      await audioCache.clearAudioCache();
      setCacheStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cacheStats,
    isLoading,
    getCachedAudio,
    cacheSeparationResult,
    clearCache,
    refreshStats: loadStats,
  };
}
```

---

## 7. UI Komponenta za Cache Management

### File: `src/components/CacheManager/CacheManager.tsx`

```typescript
import React from 'react';
import { useAudioCache } from '@/hooks/useAudioCache';

export function CacheManager() {
  const {
    cacheStats,
    isLoading,
    clearCache,
    refreshStats,
  } = useAudioCache();

  if (!cacheStats) {
    return <div>Loading cache stats...</div>;
  }

  const handleClearCache = async () => {
    if (window.confirm('Are you sure? This will delete all cached audio files.')) {
      await clearCache();
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="text-lg font-bold mb-4">Cache Management</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-gray-600">Cached Files:</p>
          <p className="text-2xl font-bold">{cacheStats.totalFiles}</p>
        </div>
        <div>
          <p className="text-gray-600">Total Size:</p>
          <p className="text-2xl font-bold">{cacheStats.totalSizeGB.toFixed(2)} GB</p>
        </div>
      </div>

      {cacheStats.files.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Recent Files:</p>
          <ul className="text-sm">
            {cacheStats.files.slice(-5).map((file, i) => (
              <li key={i} className="py-1 border-b">
                {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleClearCache}
        disabled={isLoading}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
      >
        {isLoading ? 'Clearing...' : 'Clear Cache'}
      </button>

      <button
        onClick={refreshStats}
        disabled={isLoading}
        className="ml-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh
      </button>
    </div>
  );
}
```

---

## 8. Eksport/Import Functions

### File: `src/utils/storage/backup.ts`

```typescript
import { db } from './audioDatabase';

export async function exportDatabase(): Promise<Blob> {
  const models = await db.models.toArray();
  const logs = await db.processingLogs.toArray();

  // Spremi samo metapodatke (bez velikih ArrayBuffer-a)
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    models: models.map((m) => ({
      name: m.name,
      version: m.version,
      size: m.size,
      downloadedAt: m.downloadedAt,
    })),
    logs,
  };

  return new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
}

export async function importDatabase(file: File): Promise<void> {
  const content = await file.text();
  const backup = JSON.parse(content);

  console.log(`Importing backup from ${backup.exportedAt}`);
  console.log(`Found ${backup.models.length} models and ${backup.logs.length} logs`);

  // Importuj logove
  for (const log of backup.logs) {
    await db.processingLogs.add(log);
  }

  console.log('✅ Backup imported');
}
```

---

## 9. Ograničenja i Best Practices

### ✅ Što trebaš raditi

- Koristi IndexedDB za velikoće veće od 50 MB
- Koristi localStorage samo za male konfiguracije
- Redovito čisti stare cache-e (LRU política)
- Spremi hasheve datoteka za brz lookup
- Monitoring quota usage

### ❌ Što NE trebaš raditi

- Ne spremi lozinke ili osjetljive podatke
- Ne koristi synchronous API (blokirat će UI)
- Ne spremi cijele audio datoteke neobrađene
- Ne zaboravi error handling kod DB operacija

---

## 10. Quota Management

```typescript
// Provjeri dostupan prostor
async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
}> {
  const estimate = await (navigator as any).storage?.estimate();

  return {
    usage: estimate.usage,
    quota: estimate.quota,
    percentUsed: (estimate.usage / estimate.quota) * 100,
  };
}

// Pozovi periodički
setInterval(async () => {
  const stats = await checkStorageQuota();
  if (stats.percentUsed > 80) {
    console.warn(`⚠️  Storage ${stats.percentUsed.toFixed(0)}% full!`);
    // Pokreni eviction
  }
}, 60000); // Svaki minut
```

