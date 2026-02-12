---
name: audio-processor
description: Manage audio manipulation, vocal separation, and track downloading for the Karaoke app.
metadata:
  version: "1.0.0"
  category: audio
  usage-context: "separation", "download", "web-audio"
---

# Audio Processor

The `audio-processor` skill provides guidance and automated patterns for handling audio files within the Muzika project, specifically leveraging the local `python-audio-cli`.

## Core Capabilities

### 1. Vocal Separation
When asked to "separate vocals" or "split track":
1. Use `python-audio-cli/separator.py`.
2. Recommended command: `python3 separator.py --input <file> --output <dir>`.
3. Inform the user that processing happens on the background server if applicable.

### 2. Audio Downloading
When asked to "download track" or "fetch audio":
1. Use `python-audio-cli/downloader.py`.
2. Supports YouTube and other common sources for karaoke extraction.

### 3. Web Audio API Integration
Reference `6_AUDIO_PROCESSING.md` for standard project implementations:
- `AudioContextManager`: Standardized context initialization.
- `PlaybackController`: For play/pause/seek logic.
- `SoundTouchProcessor`: For pitch and tempo adjustment.

## Best Practices
- Always normalize audio output to avoid clipping.
- Use 44.1kHz sample rate for maximum compatibility.
- Ensure large audio buffers are handled in Web Workers to prevent UI blocking.
