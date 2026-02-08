# Muzika - AI-Powered Karaoke Application

A modern web application for AI-powered vocal separation and karaoke. Process audio files locally in your browser or use the Python backend for enhanced features.

## Features

- 🎤 **AI Vocal Separation** - Separate vocals from instrumentals using ONNX models
- 🎵 **Karaoke Mode** - Real-time pitch shifting and tempo control
- 📚 **Song Library** - Manage your processed songs with IndexedDB
- 🌐 **YouTube Integration** - Download and process YouTube videos
- 🐍 **Python Backend** - Optional server-side processing with Demucs
- 💾 **Cloud Library** - Access songs processed on the backend server

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. (Optional) Set Up Python Backend

For enhanced YouTube downloading and server-side processing:

```bash
cd ../python-audio-cli
bash setup.sh
cd ../audio-karaoke-app
```

### 3. Start Development Server

```bash
npm run dev
```

This will start:

- **Next.js app** on <http://localhost:3000>
- **Python backend** on <http://localhost:8000> (if configured)

Open <http://localhost:3000> in your browser.

### Run Without Backend

If you only want the Next.js app:

```bash
npm run dev:next-only
```

## Backend Features

The Python backend provides:

- ✅ Stable YouTube audio extraction using yt-dlp
- ✅ Server-side audio processing with Demucs
- ✅ Cloud library for downloaded songs
- ✅ Persistent storage on the server

## Available Scripts

- `npm run dev` - Start both Next.js and Python backend
- `npm run dev:next-only` - Start only Next.js (no backend)
- `npm run dev:next` - Start Next.js server only
- `npm run dev:python` - Start Python backend only
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **AI/ML**: ONNX Runtime Web, WebGPU
- **Storage**: IndexedDB (Dexie.js)
- **Audio**: Web Audio API, SoundTouch.js
- **Backend**: FastAPI, yt-dlp, Demucs (optional)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Project Architecture](../1_PROJECT_ARCHITECTURE.md)
- [Setup Guide](../2_SETUP_GUIDE.md)
- [API Specification](../3_API_SPECIFICATION.md)

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## License

MIT
