# Muzika Karaoke - Local Development Setup Guide (Fish Shell)

## Overview

Muzika Karaoke is a modern web application for AI-powered vocal separation and karaoke. The application uses a hybrid architecture:

- **Frontend**: Next.js 16 with React 19, TypeScript, and Tailwind CSS 4
- **Backend**: Python FastAPI server for enhanced YouTube downloading and server-side audio processing
- **AI/ML**: ONNX Runtime Web for browser-based inference, with optional WebGPU acceleration
- **Storage**: IndexedDB (Dexie.js) for client-side persistence
- **Audio Processing**: Web Audio API, SoundTouch.js, and FFmpeg.wasm

The application can run in two modes:
1. **Frontend-only mode**: All processing happens in the browser using WebAssembly
2. **Full-stack mode**: Frontend + Python backend for enhanced features (YouTube downloads, server-side processing)

---

## Prerequisites

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Operating System | Ubuntu 20.04+, macOS 12+, Windows 10+ | Ubuntu 22.04+, macOS 14+ |
| Node.js | 18.x | 20.x or 22.x |
| Python | 3.8+ | 3.10+ |
| RAM | 4GB | 8GB+ (16GB for large audio files) |
| Disk Space | 2GB | 5GB+ (for models and cache) |
| GPU | None | NVIDIA GPU with CUDA (for Python backend) |

### Browser Requirements

- **Chrome/Edge**: 90+ (recommended for WebGPU support)
- **Firefox**: 88+
- **Safari**: 14+

**Required Browser Features**:
- WebAssembly support
- Web Audio API
- IndexedDB
- SharedArrayBuffer (for multi-threading)
- WebGPU (optional, for acceleration)

### Software Dependencies

#### For Linux (Ubuntu/Debian)

```fish
# Update package list
sudo apt update

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3 and pip
sudo apt install -y python3 python3-pip python3-venv

# Install FFmpeg (required for audio processing)
sudo apt install -y ffmpeg

# Install build tools (for some Python packages)
sudo apt install -y build-essential

# Optional: Install CUDA toolkit for GPU acceleration
# sudo apt install -y nvidia-cuda-toolkit
```

#### For macOS

```fish
# Install Homebrew if not already installed
/bin/bash -c "(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Install Python 3
brew install python@3.11

# Install FFmpeg
brew install ffmpeg

# Optional: Install CUDA toolkit for GPU acceleration
# brew install cuda
```

#### For Windows

```powershell
# Install Node.js from https://nodejs.org/
# Install Python 3 from https://www.python.org/
# Install FFmpeg from https://ffmpeg.org/download.html

# Add FFmpeg to PATH
# Set environment variable: FFMPEG_PATH=C:\path\to\ffmpeg\bin
```

---

## Quick Start

Get the application running in 3-5 commands:

```fish
# 1. Navigate to the project directory
cd /home/k/Downloads/muzika

# 2. Install frontend dependencies
cd audio-karaoke-app
npm install

# 3. Start the development server (frontend-only mode)
npm run dev:next-only
```

Open your browser to: **http://localhost:3030**

### Quick Start with Backend (Full-Stack Mode)

```fish
# 1. Navigate to the project directory
cd /home/k/Downloads/muzika

# 2. Install frontend dependencies
cd audio-karaoke-app
npm install

# 3. Set up Python backend (automated)
cd ../python-audio-cli
bash setup.sh

# 4. Start both servers
cd ../audio-karaoke-app
npm run dev
```

Open your browser to: **http://localhost:3030**

The Python backend will be available at: **http://localhost:8000**

---

## Detailed Setup Steps

### Step 1: Install System Dependencies

#### Linux (Ubuntu/Debian)

```fish
# Update system packages
sudo apt update; and sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
node --version  # Should output v20.x.x
npm --version   # Should output 10.x.x

# Install Python 3 and development tools
sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential

# Verify Python installation
python3 --version  # Should output 3.8+

# Install FFmpeg
sudo apt install -y ffmpeg

# Verify FFmpeg installation
ffmpeg -version

# Optional: Install system-level audio libraries
sudo apt install -y libasound2-dev libpulse-dev
```

#### macOS

```fish
# Update Homebrew
brew update

# Install Node.js
brew install node

# Verify Node.js installation
node --version
npm --version

# Install Python 3.11
brew install python@3.11

# Verify Python installation
python3 --version

# Install FFmpeg
brew install ffmpeg

# Verify FFmpeg installation
ffmpeg -version
```

### Step 2: Set Up Python Backend

```fish
# Navigate to the Python backend directory
cd python-audio-cli

# Run the automated setup script
bash setup.sh
```

The setup script will:
1. Create a Python virtual environment
2. Install all required dependencies
3. Set up output directories

**Manual Setup (if script fails)**:

```fish
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate.fish  # Linux/macOS with fish shell
# venv\Scripts\activate   # Windows

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Create output directories
mkdir -p output/downloads output/stems

# Deactivate virtual environment
deactivate
```

### Step 3: Set Up Next.js Frontend

```fish
# Navigate to the frontend directory
cd audio-karaoke-app

# Install dependencies
npm install

# Verify installation
npm run type-check  # Check TypeScript types
```

### Step 4: Configure Environment Variables

Create a `.env.local` file in the `audio-karaoke-app` directory:

```fish
# Backend API URL
set -x NEXT_PUBLIC_BACKEND_URL http://localhost:8000

# Model configuration
set -x NEXT_PUBLIC_DEFAULT_MODEL mdx-net
set -x NEXT_PUBLIC_MODEL_CACHE_SIZE 1000000000  # 1GB in bytes

# Audio processing
set -x NEXT_PUBLIC_MAX_AUDIO_SIZE 104857600  # 100MB in bytes
set -x NEXT_PUBLIC_CHUNK_SIZE 30  # seconds
set -x NEXT_PUBLIC_SAMPLE_RATE 44100

# Feature flags
set -x NEXT_PUBLIC_ENABLE_WEBGPU true
set -x NEXT_PUBLIC_ENABLE_YOUTUBE true
set -x NEXT_PUBLIC_ENABLE_BATCH_PROCESSING true

# Development
set -x NEXT_PUBLIC_DEV_MODE true
```

**Environment Variable Defaults**:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:8000` | Python backend URL |
| `NEXT_PUBLIC_DEFAULT_MODEL` | `mdx-net` | Default AI model for separation |
| `NEXT_PUBLIC_MODEL_CACHE_SIZE` | `1000000000` | Max cache size for models (1GB) |
| `NEXT_PUBLIC_MAX_AUDIO_SIZE` | `104857600` | Max audio file size (100MB) |
| `NEXT_PUBLIC_CHUNK_SIZE` | `30` | Audio chunk size in seconds |
| `NEXT_PUBLIC_SAMPLE_RATE` | `44100` | Audio sample rate in Hz |
| `NEXT_PUBLIC_ENABLE_WEBGPU` | `true` | Enable WebGPU acceleration |
| `NEXT_PUBLIC_ENABLE_YOUTUBE` | `true` | Enable YouTube integration |
| `NEXT_PUBLIC_ENABLE_BATCH_PROCESSING` | `true` | Enable batch processing |
| `NEXT_PUBLIC_DEV_MODE` | `true` | Development mode |

### Step 5: Start the Development Servers

#### Option A: Start Both Servers (Full-Stack Mode)

```fish
cd audio-karaoke-app
npm run dev
```

This will start:
- **Next.js frontend** on `http://localhost:3030`
- **Python backend** on `http://localhost:8000`

#### Option B: Start Frontend Only

```fish
cd audio-karaoke-app
npm run dev:next-only
```

This will start only the Next.js frontend on `http://localhost:3030`

#### Option C: Start Backend Only

```fish
cd python-audio-cli
bash start-backend.sh
```

This will start only the Python backend on `http://localhost:8000`

#### Option D: Start Frontend and Backend Separately

```fish
# Terminal 1: Start Python backend
cd python-audio-cli
bash start-backend.sh

# Terminal 2: Start Next.js frontend
cd audio-karaoke-app
npm run dev:next
```

---

## Project Structure

```
muzika/
├── audio-karaoke-app/          # Next.js frontend application
│   ├── public/                 # Static assets
│   │   ├── wasm/              # ONNX Runtime WebAssembly files
│   │   ├── ffmpeg/            # FFmpeg WebAssembly files
│   │   ├── models/            # AI model files
│   │   └── audio/             # Audio worklet files
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── [locale]/      # Internationalized routes
│   │   │   └── api/           # API routes
│   │   ├── components/        # React components
│   │   │   ├── AudioUpload/   # Audio upload components
│   │   │   ├── Karaoke/       # Karaoke player components
│   │   │   ├── Library/       # Song library components
│   │   │   └── ModelManager/  # Model management components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/             # Utility functions
│   │   │   ├── audio/         # Audio processing utilities
│   │   │   ├── ml/            # Machine learning utilities
│   │   │   ├── storage/       # IndexedDB storage utilities
│   │   │   └── karaoke/       # Karaoke-specific utilities
│   │   ├── types/             # TypeScript type definitions
│   │   ├── workers/           # Web Workers
│   │   └── i18n/              # Internationalization
│   ├── package.json           # Frontend dependencies
│   ├── next.config.ts         # Next.js configuration
│   └── tsconfig.json          # TypeScript configuration
│
├── python-audio-cli/          # Python backend application
│   ├── api.py                 # FastAPI server
│   ├── cli.py                 # CLI entry point
│   ├── downloader.py          # YouTube downloader
│   ├── separator.py           # Audio separator
│   ├── utils.py               # Helper functions
│   ├── streamlit_app.py       # Streamlit GUI
│   ├── requirements.txt       # Python dependencies
│   ├── setup.sh               # Setup script
│   ├── start-backend.sh       # Backend startup script
│   └── output/                # Output directory
│       ├── downloads/         # Downloaded audio files
│       └── stems/             # Separated audio stems
│
├── .venv/                     # Python virtual environment
├── node_modules/              # Node.js dependencies
└── DEVOPS_SETUP_GUIDE.md      # This file
```

---

## Available Scripts

### Frontend Scripts (audio-karaoke-app/package.json)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both Next.js and Python backend |
| `npm run dev:next` | Start Next.js server only |
| `npm run dev:python` | Start Python backend only |
| `npm run dev:next-only` | Start Next.js without backend |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run type-check` | Check TypeScript types |
| `npm run analyze` | Analyze bundle size |

### Backend Scripts (python-audio-cli/)

| Script | Description |
|--------|-------------|
| `bash setup.sh` | Automated setup script |
| `bash start-backend.sh` | Start FastAPI server |
| `python cli.py <url>` | Run CLI tool |
| `python api.py` | Run API server directly |
| `streamlit run streamlit_app.py` | Run Streamlit GUI |

---

## API Endpoints

### Python Backend API (http://localhost:8000)

#### Health Check
```
GET /api/health
```
Response:
```json
{
  "status": "healthy",
  "device": "cuda" | "cpu",
  "separator_initialized": true,
  "current_model": "htdemucs"
}
```

#### List Available Models
```
GET /api/models
```
Response:
```json
{
  "models": ["htdemucs", "htdemucs_ft", "mdx-net-inst-v1"]
}
```

#### Download YouTube Audio
```
POST /api/download
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=...",
  "format": "mp3"
}
```
Response:
```json
{
  "status": "success",
  "filename": "song.mp3",
  "path": "downloads/song.mp3"
}
```

#### Separate Audio into Stems
```
POST /api/separate
Content-Type: application/json

{
  "filename": "song.mp3",
  "model": "htdemucs"
}
```
Response:
```json
{
  "status": "success",
  "stems": {
    "vocals": "stems/song/vocals.wav",
    "drums": "stems/song/drums.wav",
    "bass": "stems/song/bass.wav",
    "other": "stems/song/other.wav"
  }
}
```

#### Get Library
```
GET /api/library
```
Response:
```json
{
  "songs": [
    {
      "filename": "song.mp3",
      "path": "downloads/song.mp3",
      "stems": {
        "vocals": "stems/song/vocals.wav",
        "drums": "stems/song/drums.wav",
        "bass": "stems/song/bass.wav",
        "other": "stems/song/other.wav"
      }
    }
  ]
}
```

#### Upload File
```
POST /api/upload
Content-Type: multipart/form-data

file: <audio file>
```
Response:
```json
{
  "status": "success",
  "filename": "uploaded.mp3"
}
```

#### Get File
```
GET /files/{path}
```
Example: `GET /files/downloads/song.mp3`
Returns: Audio file

### Next.js API Routes (http://localhost:3030)

#### Backend Proxy Routes
```
POST /api/backend-download    # Proxy to Python backend download
POST /api/backend-upload      # Proxy to Python backend upload
GET  /api/backend-library     # Proxy to Python backend library
GET  /api/backend-files/{...path}  # Proxy to Python backend files
```

#### Frontend API Routes
```
GET  /api/status              # Application status
GET  /api/models              # Available models
POST /api/proxy-model         # Model proxy endpoint
POST /api/python-processing   # Python processing endpoint
POST /api/report-error        # Error reporting
POST /api/extract-youtube     # YouTube extraction
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3030` or `:::8000`

**Solution**:
```fish
# Kill process on port 3030
fuser -k 3030/tcp  # Linux
lsof -ti:3030 | xargs kill -9  # macOS

# Kill process on port 8000
fuser -k 8000/tcp  # Linux
lsof -ti:8000 | xargs kill -9  # macOS
```

#### 2. Python Virtual Environment Issues

**Error**: `ModuleNotFoundError: No module named 'fastapi'`

**Solution**:
```fish
cd python-audio-cli

# Remove existing virtual environment
rm -rf venv

# Create new virtual environment
python3 -m venv venv

# Activate and install dependencies
source venv/bin/activate.fish
pip install -r requirements.txt
```

#### 3. FFmpeg Not Found

**Error**: `ffmpeg: command not found`

**Solution**:
```fish
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

#### 4. Node.js Version Incompatible

**Error**: `Error: The module was compiled against a different Node.js version`

**Solution**:
```fish
# Remove node_modules and package-lock.json
cd audio-karaoke-app
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

#### 5. WebAssembly Loading Issues

**Error**: `WebAssembly.instantiate(): Import #0 module="env" error: module is not an object`

**Solution**:
- Ensure you're using a modern browser with WebAssembly support
- Check that the WASM files are in the correct location: `public/wasm/`
- Clear browser cache and reload

#### 6. Out of Memory During Audio Processing

**Error**: `JavaScript heap out of memory` or `Process finished with exit code 137`

**Solution**:
```fish
# Increase Node.js memory limit
set -x NODE_OPTIONS "--max-old-space-size=4096"

# Or use smaller audio files
# Reduce chunk size in .env.local
set -x NEXT_PUBLIC_CHUNK_SIZE 15
```

#### 7. CORS Errors

**Error**: `Access to fetch at 'http://localhost:8000' from origin 'http://localhost:3030' has been blocked by CORS policy`

**Solution**:
- Ensure the Python backend is running
- Check that CORS is enabled in `python-audio-cli/api.py`
- Verify the backend URL in `.env.local`

#### 8. YouTube Download Fails

**Error**: `ERROR: [youtube] Unable to download webpage`

**Solution**:
```fish
# Update yt-dlp
cd python-audio-cli
source venv/bin/activate.fish
pip install --upgrade yt-dlp
```

#### 9. Model Download Fails

**Error**: `Failed to download model: Network error`

**Solution**:
- Check your internet connection
- Try downloading the model manually and place it in `public/models/`
- Use a VPN if the model is hosted on a blocked domain

#### 10. IndexedDB Quota Exceeded

**Error**: `QuotaExceededError: The quota has been exceeded`

**Solution**:
- Clear browser data for the application
- Reduce cache size in `.env.local`:
  ```fish
  set -x NEXT_PUBLIC_MODEL_CACHE_SIZE 500000000  # 500MB
  ```

### Debug Mode

Enable debug logging:

```fish
# Frontend
set -x NEXT_PUBLIC_DEV_MODE true
set -x NEXT_PUBLIC_LOG_LEVEL debug

# Backend
set -x LOG_LEVEL debug
```

### Check System Status

```fish
# Check Node.js version
node --version

# Check Python version
python3 --version

# Check FFmpeg version
ffmpeg -version

# Check available ports
netstat -tuln | grep -E '3030|8000'

# Check disk space
df -h

# Check memory usage
free -h  # Linux
vm_stat  # macOS
```

---

## Development Workflow

### 1. Code Structure

- **Components**: Located in `src/components/`
- **Hooks**: Located in `src/hooks/`
- **Utilities**: Located in `src/utils/`
- **Types**: Located in `src/types/`
- **API Routes**: Located in `src/app/api/`

### 2. Adding New Features

1. Create component in appropriate directory
2. Add TypeScript types in `src/types/`
3. Create utility functions in `src/utils/`
4. Add tests in `__tests__/` directories
5. Update documentation

### 3. Running Tests

```fish
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- AudioProcessor.test.ts

# Run E2E tests with Playwright
npx playwright test
```

### 4. Type Checking

```fish
# Check TypeScript types
npm run type-check

# Watch for type errors
npx tsc --noEmit --watch
```

### 5. Linting

```fish
# Run ESLint
npm run lint

# Fix linting issues automatically
npm run lint -- --fix
```

### 6. Building for Production

```fish
# Build the application
npm run build

# Test production build locally
npm run start

# Analyze bundle size
npm run analyze
```

### 7. Git Workflow

```fish
# Create a new branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request
```

### 8. Hot Reloading

The development servers support hot reloading:
- Frontend changes are reflected immediately
- Backend changes trigger automatic restart
- Python backend uses `--reload` flag

### 9. Debugging

**Frontend Debugging**:
- Use browser DevTools (F12)
- React DevTools extension
- Redux DevTools extension (if using Redux)

**Backend Debugging**:
- Use Python debugger: `import pdb; pdb.set_trace()`
- Check logs in terminal
- Use FastAPI's built-in docs at `http://localhost:8000/docs`

---

## Additional Resources

### Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/api/js/)
- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

### Project Documentation

- [Project Architecture](./1_PROJECT_ARCHITECTURE.md)
- [Setup Guide](./2_SETUP_GUIDE.md)
- [API Specification](./3_API_SPECIFICATION.md)
- [Web Workers Guide](./4_WEB_WORKERS.md)
- [ONNX GPU Integration](./5_ONNX_GPU_INTEGRATION.md)
- [Audio Processing Guide](./6_AUDIO_PROCESSING.md)
- [IndexedDB Storage Guide](./7_INDEXEDDB_STORAGE.md)
- [Testing & Deployment](./8_TESTING_OPTIMIZATION_DEPLOYMENT.md)
- [Roadmap & Timeline](./9_ROADMAP_TIMELINE.md)
- [Glossary & FAQ](./10_GLOSSARY_FAQ.md)

### Deployment Guides

- [Vercel CLI Guide](./VERCEL_CLI_GUIDE.md)
- [MCP Setup Guide](./MCP_SETUP_GUIDE.md)
- [Frontend Deployment](./audio-karaoke-app/DEPLOYMENT.md)
- [Vercel Setup](./audio-karaoke-app/VERCEL_SETUP.md)

### External Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [Demucs Documentation](https://github.com/facebookresearch/demucs)
- [SoundTouch.js Documentation](https://github.com/cutterbl/soundtouchjs)
- [Tone.js Documentation](https://tonejs.github.io/)

### Community & Support

- [GitHub Issues](https://github.com/your-repo/muzika/issues)
- [GitHub Discussions](https://github.com/your-repo/muzika/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/muzika)

---

## Port Information

| Service | Port | Protocol | URL |
|---------|------|----------|-----|
| Next.js Frontend | 3030 | HTTP | http://localhost:3030 |
| Python Backend | 8000 | HTTP | http://localhost:8000 |
| Streamlit GUI | 8501 | HTTP | http://localhost:8501 |

---

## Hardware Requirements Summary

### Minimum Requirements
- **CPU**: Dual-core processor
- **RAM**: 4GB
- **Storage**: 2GB free space
- **GPU**: Not required

### Recommended Requirements
- **CPU**: Quad-core processor or better
- **RAM**: 8GB+ (16GB for large audio files)
- **Storage**: 5GB+ free space
- **GPU**: NVIDIA GPU with CUDA support (for Python backend)

### Optimal Requirements
- **CPU**: 8-core processor or better
- **RAM**: 16GB+
- **Storage**: 10GB+ SSD
- **GPU**: NVIDIA RTX series with 8GB+ VRAM

---

## Browser Compatibility Matrix

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| WebAssembly | ✅ 57+ | ✅ 16+ | ✅ 52+ | ✅ 11+ |
| Web Audio API | ✅ 14+ | ✅ 12+ | ✅ 25+ | ✅ 6+ |
| IndexedDB | ✅ 24+ | ✅ 10+ | ✅ 16+ | ✅ 7+ |
| SharedArrayBuffer | ✅ 92+ | ✅ 92+ | ✅ 89+ | ✅ 15.2+ |
| WebGPU | ✅ 113+ | ✅ 113+ | ✅ Nightly | ❌ |
| Web Workers | ✅ 4+ | ✅ 10+ | ✅ 3.5+ | ✅ 4+ |

**Recommended Browser**: Chrome 113+ or Edge 113+ for full feature support.

---

## License

MIT License - See LICENSE file for details.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-02-11 | Initial DevOps setup guide |
| 1.1.0 | 2024-02-11 | Updated for fish shell syntax |

---

*Last Updated: 2024-02-11*
