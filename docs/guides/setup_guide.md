# Development Environment Setup Guide

> **Last Updated**: February 2026

This guide walks you through setting up the full Muzika development environment — both the Next.js frontend and the Python audio backend.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ LTS | [nodejs.org](https://nodejs.org/) |
| npm | 9+ | Bundled with Node.js |
| Python | 3.8+ | [python.org](https://python.org/) |
| ffmpeg | any | [ffmpeg.org](https://ffmpeg.org/) — required by yt-dlp and audio processing |
| Git | any | [git-scm.com](https://git-scm.com/) |

**Verify your installations:**
```bash
node --version    # Should print v18+
npm --version     # Should print 9+
python3 --version # Should print 3.8+
ffmpeg -version   # Should print version info
git --version     # Any version
```

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/muzika.git
cd muzika
```

---

## Step 2: Frontend Setup (Next.js)

```bash
cd audio-karaoke-app
npm install
```

**Verify the install:**
```bash
npm run build 2>&1 | tail -5  # Should complete with no errors
```

---

## Step 3: Python Backend Setup

```bash
cd ../python-audio-cli

# Automatic setup (creates venv + installs all dependencies)
bash setup.sh
```

If you prefer manual setup:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

> **Note**: `ffmpeg` must be installed at the system level (not Python-level) for audio processing to work.

---

## Step 4: Environment Variables

```bash
cd ../audio-karaoke-app
cp .env.local.example .env.local
```

Edit `.env.local`:
```bash
NEXT_PUBLIC_PYTHON_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 5: Start the Development Servers

```bash
cd audio-karaoke-app

# Starts both Next.js (port 3000) and Python backend (port 8000)
npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)** in **Chrome 113+** or **Edge 113+**.

### Frontend only (no Python backend):
```bash
npm run dev:next-only
```

### Python backend only (manual):
```bash
cd python-audio-cli
bash start-backend.sh
# API available at http://localhost:8000
```

---

## Project Structure

```
muzika/
├── audio-karaoke-app/           # Next.js 14 frontend
│   ├── src/
│   │   ├── app/                 # App Router: pages, API routes
│   │   │   ├── [locale]/        # i18n: page.tsx is the main entry
│   │   │   └── api/             # API routes (backend-proxy, youtube, etc.)
│   │   ├── components/
│   │   │   ├── AudioUpload/     # File drag-and-drop, YouTube input
│   │   │   ├── Karaoke/         # KaraokePlayer, LyricDisplay, VisualizerCanvas
│   │   │   ├── Library/         # Song library grid and management
│   │   │   └── UI/              # Shared UI components
│   │   ├── hooks/               # Custom React hooks (useSeparation, useKaraoke, …)
│   │   ├── utils/
│   │   │   ├── audio/           # AudioContext, PlaybackController, audioEngine
│   │   │   ├── ml/              # ONNX inference, model management
│   │   │   ├── karaoke/         # LRC parser, lyric sync engine
│   │   │   └── storage/         # IndexedDB stores (Dexie.js)
│   │   └── workers/             # Web Workers: audio.worker.ts
│   ├── e2e/                     # Playwright E2E tests
│   ├── public/
│   │   └── wasm/                # ONNX Runtime WASM binaries
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── python-audio-cli/            # Python FastAPI backend
    ├── api.py                   # Main FastAPI server
    ├── separator.py             # HTDemucs separation
    ├── downloader.py            # yt-dlp YouTube downloader
    ├── setup.sh                 # One-command setup
    └── requirements.txt
```

---

## Configuring TypeScript

The `tsconfig.json` in `audio-karaoke-app/` is pre-configured with:
- **Strict mode** enabled
- **Path alias** `@/*` maps to `./src/*`
- **Target**: ES2020 with DOM libs

If you add new path aliases, update both `tsconfig.json` and `next.config.ts`.

---

## Editor Setup (VS Code)

Recommended extensions (`.vscode/extensions.json` should prompt automatically):
- **ESLint** — real-time linting
- **Prettier** — auto-formatting on save
- **TypeScript Hero** — organize imports
- **Tailwind CSS IntelliSense** — class autocomplete

---

## Running Tests

```bash
# All frontend tests
cd audio-karaoke-app && npm test

# All backend tests
cd python-audio-cli && pytest tests/ -v

# E2E browser tests
cd audio-karaoke-app && npx playwright test
```

→ See **[../../docs/testing/TESTING_GUIDE.md](../../docs/testing/TESTING_GUIDE.md)** for the full 5-stage testing guide.

---

## Troubleshooting

### "WebGPU not available"
Use **Chrome 113+** or **Edge 113+**. To force-enable in older builds:
```bash
google-chrome --enable-features=Vulkan
```

### Out of Memory during `npm run dev`
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

### Python backend fails to start
```bash
# Check if port 8000 is already in use
lsof -i :8000
kill -9 <PID>

# Re-run setup
cd python-audio-cli && bash setup.sh
```

### "Module not found" TypeScript error
Verify path aliases match between `tsconfig.json` paths and `next.config.ts` webpack aliases.

### WASM files missing (ONNX errors)
```bash
cd audio-karaoke-app
cp node_modules/onnxruntime-web/dist/*.wasm public/wasm/
```

---

## Next Steps

Once your environment is running:
1. Read **[developer_guide.md](developer_guide.md)** for contributing guidelines
2. Read **[../architecture/project_architecture.md](../architecture/project_architecture.md)** for system design
3. Check **[../../MUZIKA_ENGINEER_TODO.md](../../MUZIKA_ENGINEER_TODO.md)** for current tasks
