---
name: lyric-syncer
description: Manage and synchronize lyrics for Karaoke tracks using LRC format and SyncEngine patterns.
metadata:
  version: "1.0.0"
  category: karaoke
  usage-context: "lyrics", "sync", "lrc"
---

# Lyric Syncer

The `lyric-syncer` skill provides standards for creating and managing time-synced lyrics in the Muzika project.

## Core Capabilities

### 1. LRC File Management
- **Format**: Standard LRC with `[mm:ss.xx]` timestamps.
- **Enhanced Format**: Word-level synchronization `[mm:ss.xx]<mm:ss.xx>word` for premium "scrolling" effects.

### 2. Synchronization Engine
Reference `Real-time Karaoke Application Architecture` KI and `overview.md`:
- Use `SyncEngine` for high-precision timing.
- Synchronize with the `currentTime` from `PlaybackController`.

### 3. Next.js Implementation
- Use the `useLyricSync` hook to manage active lines.
- Ensure lyrics are pre-fetched or streamed alongside audio tracks.

## Best Practices
- Always validate LRC timestamps against audio duration.
- Implement "lookahead" (e.g., 200ms) to ensure smooth visual transitions.
- Handle multi-language character sets (UTF-8).
