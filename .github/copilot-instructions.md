# AI Agent Coding Guidelines for Muzika Codebase

## Overview
This document provides essential guidelines for AI coding agents working on the Muzika codebase. The project is a local audio karaoke application with AI-powered vocal and instrumental separation. The following sections outline the architecture, workflows, conventions, and integration points to help AI agents be immediately productive.

---

## Big Picture Architecture

### Key Components
1. **Frontend**: Built with React 18, Next.js 14, TypeScript, and Tailwind CSS.
2. **AI/ML**: Uses ONNX Runtime Web for AI inference, leveraging WebGPU/WASM for performance.
3. **Audio Processing**: Implements Web Audio API, AudioWorklets, and SoundTouchJS for playback and manipulation.
4. **Storage**: IndexedDB (via Dexie.js) for caching models and separation results.

### Data Flow
- **Input**: Audio files uploaded via `AudioUpload` component.
- **Processing**: Audio separation handled by Web Workers and ONNX models.
- **Output**: Separated audio streams rendered in the `PlayerControls` component.
- **Caching**: Results stored locally in IndexedDB for reuse.

### Why This Structure?
- **Performance**: Offloads heavy computation to Web Workers and GPU.
- **Local Processing**: Ensures user privacy by avoiding server-side processing.
- **Scalability**: Modular design allows easy integration of new models and features.

---

## Developer Workflows

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) to view the app.

### Testing
- **Unit Tests**: Run with Jest:
  ```bash
  npm run test
  ```
- **E2E Tests**: Run with Playwright:
  ```bash
  npm run e2e
  ```

### Deployment
- Deploy to Vercel:
  ```bash
  vercel --prod
  ```
- Docker deployment:
  ```bash
  docker build -t audio-karaoke-app .
  docker run -p 3000:3000 audio-karaoke-app
  ```

---

## Project-Specific Conventions

### Code Organization
- **Components**: Located in `src/components/`. Each component has its own folder with `index.tsx` and styles.
- **Hooks**: Custom hooks are in `src/hooks/`.
- **Utilities**: Shared logic is in `src/utils/`.
- **Types**: TypeScript definitions are in `src/types/`.

### Patterns
- **React State Management**: Zustand is used for global state.
- **Error Handling**: Use `try-catch` blocks and log errors to the console.
- **Web Workers**: Communicate via `postMessage` and `onmessage`.

### Examples
- **Audio Separation**:
  ```typescript
  const result = await separateAudio(file, {
    modelType: 'mdx-net',
    onProgress: (progress) => console.log(progress.percentage),
  });
  ```
- **IndexedDB Storage**:
  ```typescript
  await modelStorage.saveModel('mdx-net', '1.0', modelData);
  const model = await modelStorage.getModel('mdx-net');
  ```

---

## Integration Points

### External Dependencies
- **ONNX Runtime Web**: For AI inference.
- **Dexie.js**: For IndexedDB interactions.
- **SoundTouchJS**: For audio pitch/time manipulation.
- **FFmpeg WASM**: For audio format conversion.

### Cross-Component Communication
- **Web Workers**: Used for audio separation and model loading.
- **React Context**: Minimal usage; Zustand preferred for state management.
- **API Calls**: Local APIs under `src/app/api/` handle model proxying and status checks.

---

## Key Files and Directories
- **`src/components/`**: UI components.
- **`src/hooks/`**: Custom React hooks.
- **`src/utils/`**: Utility functions.
- **`src/types/`**: TypeScript type definitions.
- **`src/app/api/`**: API routes for Next.js.
- **`public/models/`**: Pre-trained ONNX models.
- **`public/wasm/`**: WASM binaries for FFmpeg and ONNX.

---

## Additional Notes
- **Performance**: Optimize audio processing with WebGPU when available.
- **Security**: Ensure all processing remains local to the browser.
- **Compatibility**: Target modern browsers (Chrome 113+, Edge 113+).

---

Follow these guidelines to ensure consistency and productivity when contributing to the Muzika codebase.