# 🎵 Muzika — AI Karaoke & Audio Separation App

[![CI](https://github.com/your-org/muzika/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/muzika/actions)

A **browser-based, privacy-first** karaoke application that uses AI to separate vocals and instrumentals from any audio file — entirely locally, no uploads to any server.

---

## ✨ Features

- 🎤 **AI Audio Separation** — Isolate vocals, drums, bass, and other stems using [HTDemucs](https://github.com/facebookresearch/demucs) (server-side) or ONNX Runtime Web + WebGPU (client-side)
- 🎵 **Karaoke Player** — Synchronized lyric display, pitch/tempo control, multi-stem mixing
- 📥 **YouTube Download** — Paste a YouTube URL to download and process audio directly
- 💾 **Persistent Library** — IndexedDB-based local song library with stem caching
- 🔒 **Privacy First** — Client-side processing keeps your music on your device
- 📦 **Offline-Ready** — Service Worker support for offline playback

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Link |
|------|---------|------|
| Node.js | 18+ LTS | [nodejs.org](https://nodejs.org/) |
| Python | 3.8+ | [python.org](https://python.org/) |
| ffmpeg | any | [ffmpeg.org](https://ffmpeg.org/) |
| Git | any | [git-scm.com](https://git-scm.com/) |

### 1. Clone & Install

```bash
git clone https://github.com/your-org/muzika.git
cd muzika/audio-karaoke-app
npm install
```

### 2. Set Up the Python Backend

```bash
cd ../python-audio-cli
bash setup.sh        # creates venv + installs dependencies
```

### 3. Start the App

```bash
cd ../audio-karaoke-app
npm run dev          # starts both Next.js (port 3000) and Python backend (port 8000)
```

Open **[http://localhost:3000](http://localhost:3000)** in Chrome 113+ or Edge 113+.

> **Note**: To run only the Next.js frontend without the Python backend: `npm run dev:next-only`

---

## 🏗️ Architecture

```
muzika/
├── audio-karaoke-app/       # Next.js 14 + TypeScript frontend
│   ├── src/
│   │   ├── app/             # App Router pages & API routes
│   │   ├── components/      # React components (Karaoke/, Library/, UI/, ...)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/
│   │   │   ├── audio/       # AudioContext, PlaybackController, export
│   │   │   ├── ml/          # ONNX inference, model management, workers
│   │   │   ├── karaoke/     # LRC parser, lyric sync engine
│   │   │   └── storage/     # IndexedDB / Dexie.js stores
│   │   └── workers/         # Web Workers for off-main-thread ML
│   └── e2e/                 # Playwright end-to-end tests
│
├── python-audio-cli/        # FastAPI backend (HTDemucs separation + yt-dlp)
│   ├── api.py               # REST API server
│   ├── separator.py         # Demucs audio separation
│   └── downloader.py        # YouTube audio download
│
└── docs/                    # Full project documentation
```

**Tech Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Next.js 14, TypeScript, Tailwind CSS |
| Client-side AI | ONNX Runtime Web, WebGPU / WASM |
| Server-side AI | Python, HTDemucs, torchaudio |
| Audio | Web Audio API, AudioWorklets, SoundTouchJS |
| Storage | IndexedDB (Dexie.js) |
| Testing | Jest, Playwright, pytest |
| Deployment | Vercel (frontend) + Python server |

---

## 🧪 Testing

```bash
# Backend unit tests
cd python-audio-cli && pytest tests/ -v

# Frontend unit tests
cd audio-karaoke-app && npm test

# End-to-end browser tests
cd audio-karaoke-app && npx playwright test

# Full integration (requires both servers running)
cd audio-karaoke-app && INTEGRATION=true npx playwright test e2e/integration.spec.ts
```

→ See **[docs/testing/TESTING_GUIDE.md](docs/testing/TESTING_GUIDE.md)** for detailed instructions.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [docs/NAVIGATION.md](docs/NAVIGATION.md) | Complete doc index |
| [docs/guides/setup_guide.md](docs/guides/setup_guide.md) | Full development environment setup |
| [docs/guides/developer_guide.md](docs/guides/developer_guide.md) | Contributing, branching, code style |
| [docs/guides/user_guide.md](docs/guides/user_guide.md) | End-user guide |
| [docs/architecture/project_architecture.md](docs/architecture/project_architecture.md) | System architecture & data flow |
| [docs/architecture/api_specification.md](docs/architecture/api_specification.md) | API reference |
| [docs/deployment/deployment.md](docs/deployment/deployment.md) | Vercel & Docker deployment |
| [plans/security-performance-audit-report.md](plans/security-performance-audit-report.md) | Security & performance audit (Feb 2026) |

---

## 🔒 Security

A comprehensive security audit was conducted in February 2026 — see **[plans/security-performance-audit-report.md](plans/security-performance-audit-report.md)** for the full report (23 findings, remediation guide included).

---

## 📋 Project Status

See **[MUZIKA_ENGINEER_TODO.md](MUZIKA_ENGINEER_TODO.md)** for the current engineering task list and sprint planning.

**Current focus**: Architectural refactoring (AR-01 → AR-03) and security remediation (P0 fixes from audit).

---

## ⚙️ Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_PYTHON_SERVICE_URL=http://localhost:8000   # Python backend URL
NEXT_PUBLIC_APP_URL=http://localhost:3000               # App URL (for CORS)
```

---

## 🤝 Contributing

1. Read **[docs/guides/developer_guide.md](docs/guides/developer_guide.md)**
2. Create a branch: `task/XX-NN-your-description`
3. Run all tests before opening a PR
4. Link your PR to the task in `MUZIKA_ENGINEER_TODO.md`

---

**Version**: 2.0 | **Last Updated**: February 2026 | **Node**: 18+ | **Browsers**: Chrome 113+, Edge 113+
