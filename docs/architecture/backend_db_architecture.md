# Backend & Database Architecture for Muzika Karaoke

## 1. The Best Choice: IndexedDB (via Dexie.js)

For a web application that processes large audio files and AI models locally, **IndexedDB** is the superior choice for storage. Unlike `localStorage` (limited to ~5-10MB), IndexedDB can store gigabytes of data, making it perfect for caching AI models and saving multiple versions of processed songs.

### Why IndexedDB?
*   **Capacity**: Can store 50GB+ depending on the browser and disk space.
*   **Performance**: Asynchronous API that doesn't block the main UI thread.
*   **Structured Data**: Supports complex queries, indexing, and versioning.
*   **Privacy**: Data stays on the user's device, maintaining your "no server" promise.

## 2. Proposed Database Schema

To support saving songs, pitch/tempo variations, and custom naming, we recommend the following schema using **Dexie.js**:

```typescript
import Dexie, { Table } from 'dexie';

export interface SavedSong {
  id?: number;
  originalHash: string;      // SHA-256 of the original file
  customName: string;        // User-defined name (e.g., "My Favorite Song - Low Pitch")
  fileName: string;          // Original filename
  pitch: number;             // Pitch adjustment (e.g., -2, 0, +2)
  tempo: number;             // Tempo multiplier (e.g., 0.9, 1.0, 1.1)
  vocals: ArrayBuffer;       // Processed vocal stem
  instrumentals: ArrayBuffer; // Processed instrumental stem
  modelUsed: string;         // AI model used for separation
  savedAt: number;           // Timestamp
}

export class KaraokeDB extends Dexie {
  songs!: Table<SavedSong>;

  constructor() {
    super('MuzikaKaraokeDB');
    this.version(1).stores({
      songs: '++id, originalHash, customName, savedAt'
    });
  }
}

export const db = new KaraokeDB();
```

## 3. Implementation Features

### Saving Different Versions
Users can save multiple versions of the same song by adjusting the `pitch` and `tempo` parameters and providing a unique `customName`.

```typescript
async function saveSongVersion(
  file: File, 
  vocals: ArrayBuffer, 
  instrumentals: ArrayBuffer, 
  pitch: number, 
  tempo: number, 
  name: string
) {
  const fileHash = await calculateHash(file);
  await db.songs.add({
    originalHash: fileHash,
    customName: name,
    fileName: file.name,
    pitch,
    tempo,
    vocals,
    instrumentals,
    modelUsed: 'MDX-Net Vocal 1',
    savedAt: Date.now()
  });
}
```

### Pitch and Tempo Adjustment
To implement the *ability to change pitch and tempo*, you should use the **Web Audio API**.
*   **Tempo**: Use `AudioBufferSourceNode.playbackRate`.
*   **Pitch**: Requires more complex processing (like Phase Vocoding) or a library like `soundtouchjs` or `tone.js`.

## 4. Storage Management & Quota

Since audio files are large, it's important to monitor storage usage:

| Metric | Recommendation |
| :--- | :--- |
| **Quota Check** | Use `navigator.storage.estimate()` to warn users when space is low. |
| **Cleanup** | Implement a "Manage Storage" UI where users can delete old versions. |
| **Export/Import** | Allow users to export their database as a `.json` or `.zip` file for backup. |

## 5. Summary of Benefits

1.  **Offline Access**: Once a song is saved, it can be played without re-processing.
2.  **Personalization**: Users can build a library of songs tailored to their vocal range.
3.  **No Server Costs**: You don't need to pay for expensive cloud storage or processing.
4.  **Speed**: Retrieving from IndexedDB is significantly faster than re-running AI separation.

---
*This document was generated based on the technical requirements for the Muzika Karaoke project and best practices for client-side storage.*
