# Implementation Guide: Song Library & Advanced Karaoke Features

This guide provides detailed technical instructions for building a local song library, supporting direct karaoke uploads, and implementing real-time audio modifications (pitch/tempo) with version saving.

## 1. Unified Library Architecture

To support both "AI-Separated" and "Direct Karaoke" tracks, we need a flexible database schema.

### Updated Database Schema (Dexie.js)
```typescript
export interface SongEntry {
  id?: number;
  type: 'ai_separated' | 'direct_karaoke';
  title: string;
  artist?: string;
  versionName: string;      // e.g., "Original", "Lowered Key", "Fast Remix"
  
  // Audio Data
  instrumentalData: ArrayBuffer; 
  vocalData?: ArrayBuffer;  // Optional for direct karaoke
  
  // Metadata & Settings
  originalHash: string;
  pitchAdjustment: number;  // semitones
  tempoMultiplier: number;  // e.g., 1.1 for +10%
  duration: number;
  
  // Timestamps
  createdAt: number;
  lastPlayedAt?: number;
}
```

## 2. Feature: Direct Karaoke Upload
This bypasses the AI separation engine for files that are already instrumentals.

### Implementation Logic:
1.  **Upload Toggle**: Add a "Karaoke Mode" checkbox in the upload UI.
2.  **Skip Separation**: If checked, the file is passed directly to the `AudioContext` for playback.
3.  **Metadata Extraction**: Use `music-metadata-browser` to automatically fill the Title and Artist fields.

```typescript
async function handleDirectUpload(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const metadata = await mm.parseBlob(file);
  
  const newEntry: SongEntry = {
    type: 'direct_karaoke',
    title: metadata.common.title || file.name,
    artist: metadata.common.artist,
    versionName: 'Original Upload',
    instrumentalData: arrayBuffer,
    originalHash: await calculateHash(file),
    pitchAdjustment: 0,
    tempoMultiplier: 1.0,
    duration: 0, // Calculate using AudioContext
    createdAt: Date.now()
  };
  
  await db.songs.add(newEntry);
}
```

## 3. Feature: Real-Time Audio Modification
To change pitch and tempo without re-processing the entire file, use the **Web Audio API** or **Tone.js**.

### Pitch & Tempo Engine (using Tone.js)
```typescript
import * as Tone from 'tone';

class AudioEngine {
  private player: Tone.Player;
  private pitchShift: Tone.PitchShift;

  constructor() {
    this.pitchShift = new Tone.PitchShift().toDestination();
    this.player = new Tone.Player().connect(this.pitchShift);
  }

  async loadSong(buffer: ArrayBuffer) {
    const audioBuffer = await Tone.getContext().decodeAudioData(buffer);
    this.player.buffer = new Tone.AudioBuffer(audioBuffer);
  }

  setPitch(semitones: number) {
    this.pitchShift.pitch = semitones;
  }

  setTempo(multiplier: number) {
    this.player.playbackRate = multiplier;
  }

  play() {
    this.player.start();
  }
}
```

## 4. Feature: "Save as New Version"
This allows users to tweak a song and save their preferred settings to the library.

### Workflow:
1.  User plays a song from the library.
2.  User adjusts Pitch/Tempo sliders.
3.  User clicks "Save Version".
4.  A modal asks for a version name (e.g., "My Performance Key").
5.  A new entry is created in IndexedDB, referencing the same audio data but with new settings.

> **Optimization Tip**: To save space, you can store the `ArrayBuffer` once and use a `parentSongId` for versions, but for simplicity, storing the modified settings in a new entry is easier to manage.

## 5. UI Components to Build

### A. The Library Grid
*   **Search Bar**: Filter by title or artist.
*   **Cards**: Show song title, type (AI vs Direct), and a "Play" button.
*   **Delete/Rename**: Quick actions for library management.

### B. The "Studio" Controller
*   **Pitch Slider**: Range -6 to +6 semitones.
*   **Tempo Slider**: Range 0.5x to 1.5x.
*   **Reset Button**: Quickly return to original settings.
*   **Save Version Button**: Triggers the versioning logic.

## 6. Detailed Coding Steps

1.  **Install Dependencies**: `npm install dexie tone music-metadata-browser`.
2.  **Setup Database**: Create `db.ts` with the `SongEntry` schema.
3.  **Build Upload Logic**: Create a service that handles both AI separation and direct storage.
4.  **Integrate Tone.js**: Build a custom hook `useAudioEngine` to manage playback and effects.
5.  **Create Library UI**: Build a React/Vue component to fetch and display songs from `db.songs.toArray()`.
6.  **Implement Versioning**: Write the function to clone a song entry with updated metadata.

---
*This guide provides the technical blueprint for transforming Muzika Karaoke into a full-featured personal karaoke workstation.*
