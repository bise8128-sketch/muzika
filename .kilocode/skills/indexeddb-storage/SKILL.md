---
name: indexeddb-storage
description: Manage IndexedDB local storage for the Muzika karaoke application. Use when user asks about caching, storage, offline data, or local database operations.
metadata:
  category: data-management
  source:
    repository: https://github.com/kilo-code/skills
    path: indexeddb-storage
---

# IndexedDB Storage

Manage local storage operations using IndexedDB for the Muzika karaoke application.

## Overview

The app uses IndexedDB for:
- Audio file caching
- ML model storage
- Song library management
- Playlist persistence
- Settings storage
- Processing history

## Quick Start

### Using Storage Utilities

```typescript
// Songs storage
import { songsStorage } from '@/utils/storage/songsStorage';

// Save a song
await songsStorage.save({
  id: 'song-1',
  title: 'My Song',
  artist: 'Artist',
  audioData: audioBlob
});

// Get all songs
const songs = await songsStorage.getAll();

// Delete a song
await songsStorage.delete('song-1');
```

### Using Audio Database

```typescript
import { audioDatabase } from '@/utils/storage/audioDatabase';

// Cache audio buffer
await audioDatabase.cacheAudio('track-1', audioBuffer);

// Retrieve cached audio
const buffer = await audioDatabase.getAudio('track-1');
```

## Storage Modules

### Audio Storage

| Module | Purpose |
|--------|---------|
| `audioCache.ts` | Temporary audio file cache |
| `audioDatabase.ts` | Persistent audio storage |
| `songsStorage.ts` | Song metadata and audio |

### Model Storage

```typescript
import { modelStorage } from '@/utils/storage/modelStorage';

// Save ML model
await modelStorage.saveModel('htdemucs_ft', modelData);

// Check storage usage
const info = await modelStorage.getStorageInfo();
console.log(`Using ${info.used} bytes`);
```

### Settings Storage

```typescript
import { settingsStore } from '@/utils/storage/settingsStore';

// Save settings
await settingsStore.set('theme', 'dark');
await settingsStore.set('volume', 0.8);

// Load settings
const theme = await settingsStore.get('theme');
```

### Playlist Storage

```typescript
import { playlistStorage } from '@/utils/storage/playlistStorage';

// Create playlist
await playlistStorage.create({
  name: 'My Karaoke List',
  songs: ['song-1', 'song-2']
});

// Get all playlists
const playlists = await playlistStorage.getAll();
```

## Storage Utilities

### Audio Cache

```typescript
import { audioCache } from '@/utils/storage/audioCache';

// Cache with expiration
await audioCache.set('key', data, { 
  expiration: 24 * 60 * 60 * 1000 // 24 hours
});

// Get cached item
const cached = await audioCache.get('key');
```

### Queue Storage

```typescript
import { queueStorage } from '@/utils/storage/queueStorage';

// Save playback queue
await queueStorage.save(['song-1', 'song-2', 'song-3']);

// Load queue
const queue = await queueStorage.load();
```

## Storage Statistics

```typescript
import { storageStats } from '@/utils/storage/storageStats';

// Get detailed stats
const stats = await storageStats.getStats();

console.log({
  totalUsed: stats.totalUsed,
  audioUsed: stats.audioUsed,
  modelsUsed: stats.modelsUsed,
  otherUsed: stats.otherUsed,
  quota: stats.quota
});
```

## Key Files

- [`audio-karaoke-app/src/utils/storage/audioCache.ts`](audio-karaoke-app/src/utils/storage/audioCache.ts) - Audio caching
- [`audio-karaoke-app/src/utils/storage/audioDatabase.ts`](audio-karaoke-app/src/utils/storage/audioDatabase.ts) - Audio database
- [`audio-karaoke-app/src/utils/storage/songsStorage.ts`](audio-karaoke-app/src/utils/storage/songsStorage.ts) - Song storage
- [`audio-karaoke-app/src/utils/storage/modelStorage.ts`](audio-karaoke-app/src/utils/storage/modelStorage.ts) - ML model storage
- [`audio-karaoke-app/src/utils/storage/playlistStorage.ts`](audio-karaoke-app/src/utils/storage/playlistStorage.ts) - Playlist storage
- [`audio-karaoke-app/src/utils/storage/settingsStore.ts`](audio-karaoke-app/src/utils/storage/settingsStore.ts) - Settings

## Browser Compatibility

IndexedDB is supported in:
- Chrome/Edge 23+
- Firefox 16+
- Safari 10+
- Opera 15+

## Troubleshooting

### Storage Full

1. Clear old cached audio
2. Remove unused models
3. Implement LRU eviction

```typescript
// Clear old cache
await audioCache.clearOlderThan(Date.now() - 7 * 24 * 60 * 60 * 1000);
```

### Transaction Errors

- Handle `QuotaExceededError`
- Use try/catch for all async operations

### Data Corruption

- Add migration support for schema changes
- Implement validation before storage
