# 🎵 Muzika — Project Status & Roadmap

> **Last Updated**: February 2026

---

## ✅ What's Built

The core Muzika application is **production-ready**. Here's what's implemented and working:

### Frontend (`audio-karaoke-app/`)
- **Audio Upload & Processing**: Drag-and-drop MP3/WAV upload with real-time separation progress
- **Streaming AI Separation**: Client-side ONNX Runtime Web + WebGPU via Web Worker, streaming chunk-by-chunk output to enable early playback
- **Karaoke Player**: Synchronized LRC lyric display, pitch shifting (±12 semitones), tempo control (0.5×–2.0×), stem volume mixing, waveform visualizer
- **Stem Export**: WAV and MP3 (via FFmpeg.wasm) download of isolated stems
- **Song Library**: IndexedDB-backed library with cached stems, search, and history
- **YouTube Integration**: Paste a URL → backend downloads, separates, and returns stems
- **Batch Processing**: Queue multiple files for sequential separation
- **Localization**: i18n support with `next-intl`
- **Responsive Design**: Desktop-first with tablet/mobile breakpoints

### Backend (`python-audio-cli/`)
- **FastAPI Server**: REST API for audio download + separation, auto-started by `npm run dev`
- **HTDemucs Separation**: GPU-accelerated, 4-stem (vocals/drums/bass/other) server-side separation
- **yt-dlp Integration**: Reliable YouTube audio extraction
- **Job System**: Async job lifecycle with WebSocket progress streaming
- **File Serving**: Secured static file proxy with path traversal protection

### Infrastructure
- **Playwright E2E Tests**: Full journey, accessibility, responsive, error recovery
- **Jest Unit Tests**: API routes, hooks, components
- **pytest Backend Tests**: Endpoints, job lifecycle, WebSocket rooms
- **GitHub Actions CI**: lint → type-check → jest → playwright → pytest pipeline

---

## 🔴 Current Focus (Sprint 2: Architectural Refactoring)

These are the active engineering priorities. See **[MUZIKA_ENGINEER_TODO.md](MUZIKA_ENGINEER_TODO.md)** for full details.

| ID | Task | Status |
|----|------|--------|
| **P0** | Fix XSS via `dangerouslySetInnerHTML` | 🔜 In queue |
| **P0** | Fix path traversal in file proxy | 🔜 In queue |
| **P0** | Restrict CORS wildcard `*` | 🔜 In queue |
| AR-01 | Decompose `page.tsx` (692 lines) | 🔜 Planned |
| AR-02 | Extract custom hooks from page | 🔜 Planned |
| AR-03 | Decompose `KaraokePlayer.tsx` (678 lines) | 🔜 Planned |
| DC-01 | Set up GitHub Actions CI pipeline | 🔜 Planned |
| DC-02 | Automated deployment (Vercel + Python) | 🔜 Planned |

---

## 🟡 Coming Next (Sprint 3–4: Features)

| Feature | Description | Complexity |
|---------|-------------|-----------|
| **FI-01** | AI lyric sync (Whisper ONNX + DTW alignment) | Very High |
| **FI-02** | Real-time vocal pitch scoring | High |
| **FI-03** | PWA / offline support (Service Worker) | Medium |
| **FI-07** | Per-stem volume sliders (mute/solo) | Medium |
| **DC-03** | Redis for Python job state persistence | Medium |
| **DC-04** | Docker Compose for full-stack dev | Low |

---

## 🟢 Future Backlog

| Feature | Description |
|---------|-------------|
| FI-04 | Collaborative karaoke rooms (WebRTC) |
| FI-05 | Smart practice mode (adaptive tempo for hard passages) |
| FI-06 | AI voice transformation (RVC model) |
| FI-08 | Real-time key detection (Krumhansl-Schmuckler) |
| FI-09 | Social features & gamification (leaderboards, badges) |
| FI-10 | Audio-to-MIDI export |
| AR-06 | Component library with Storybook |
| AR-09 | Undo/redo via event sourcing |
| AR-10 | Plugin architecture for audio effects |

---

## 📊 Success Metrics

| Category | Target | Status |
|----------|--------|--------|
| Separation time | < 2× audio duration | ✅ Met |
| First Contentful Paint | < 2s | ✅ Met |
| Lighthouse score | > 85 | ✅ ~90 |
| Bundle size (main) | < 500 KB | ✅ Met |
| Vocal SDR quality | > 8 dB | ✅ HTDemucs |
| Test coverage | > 80% | 🔜 In progress |
| Security (P0 issues) | 0 open | 🔜 3 remaining |
| Uptime | > 99% | — Staging only |
