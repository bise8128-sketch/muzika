# 🛠️ Muzika Karaoke - Developer Guide

## 🏗️ Architecture Overview

Muzika Karaoke is a high-performance **Next.js** application leveraging **WebAssembly (WASM)** and **ONNX Runtime** for client-side AI audio processing.

### Key Technologies

- **Frontend**: Next.js 15+, React 19, TailwindCSS
- **State Management**: Zustand
- **AI Inference**: ONNX Runtime Web (WASM/WebGPU)
- **Audio Processing**: Web Audio API, AudioWorklets
- **Storage**: IndexedDB (via Dexie.js)
- **Backend (Optional)**: Python FastAPI (for complex offline tasks)

### Directory Structure

```text
Muzika/
├── audio-karaoke-app/       # Main Next.js Application
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # React components
│   │   │   ├── Karaoke/     # Player & Visualization
│   │   │   ├── UI/          # Shared UI Kit
│   │   ├── hooks/           # Custom React Hooks
│   │   ├── utils/           # Core Logic
│   │   │   ├── audio/       # Audio Context & processing
│   │   │   ├── ml/          # ONNX inference logic
│   │   │   └── storage/     # IndexedDB managers
│   ├── public/              # Static assets (models, images)
│   └── ...
├── python-audio-cli/        # Python Backend Utilities
└── ...
```

---

## 🚀 Development Setup

1. **Clone the repository**:
   
   ```bash
   git clone <repo-url>
   cd Muzika
   ```

2. **Install Dependencies**:
   
   ```bash
   cd audio-karaoke-app
   npm install
   ```

3. **Start Development Server**:
   
   ```bash
   npm run dev
   ```
   
   This will start the Next.js app at `http://localhost:3000`.

4. **Run Storybook** (Component Library):
   
   ```bash
   npm run storybook
   ```
   
   Access Storybook at `http://localhost:6006`.

---

## 🧪 Testing

We use **Jest** for unit testing and **Playwright** for E2E testing.

- **Run Unit Tests**:
  
  ```bash
  npm test
  ```

- **Run E2E Tests**:
  
  ```bash
  npx playwright test
  ```

---

## 🧩 Contribution Guidelines

### Code Standards

- We use **ESLint** and **Prettier**. Run `npm run lint` before committing.
- **TypeScript** is strict. Avoid `any` types.
- **Components**: Use functional components with typed props.

### Creating New Components

1. Create the component in `src/components/`.
2. Create a corresponding `.stories.tsx` file for Storybook.
3. Keep logic separate (use hooks) from presentation.

### State Management

- Use **Zustand** for global app state (user session, playback status).
- Use local `useState`/`useReducer` for isolated component state.

---

## 🐛 Debugging

### Audio Issues

- Check the browser console for `AudioContext` warnings.
- Ensure `Cross-Origin-Opener-Policy` headers are set correctly for WASM.

### Model Loading Issues

- Verify models are present in `public/models/`.
- Clear IndexedDB if you suspect cache corruption (`Application` tab in DevTools).

---

## 📦 Deployment

Review `DEPLOYMENT.md` for detailed deployment instructions using Vercel or Docker.

---

*Happy Coding!* 🚀
