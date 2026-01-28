# Development Environment Setup - Korak po Korak

## Faza 1: Preduvjeti

### Potreban software
```bash
Node.js 18+ LTS (https://nodejs.org/)
npm ili yarn (dolazi s Node.js)
Git (https://git-scm.com/)
VS Code (https://code.visualstudio.com/)
```

### Provjera instalacije
```bash
node --version    # trebalo bi v18+
npm --version     # trebalo bi v9+
git --version     # bilo koja verzija
```

---

## Faza 2: Inicijalizacija projekta

### Korak 1: Kreiranje Next.js aplikacije
```bash
# Opcija A: Korištenje create-next-app (preporučeno)
npx create-next-app@latest audio-karaoke-app --typescript --tailwind

# Opcija B: Ručna inicijalizacija
mkdir audio-karaoke-app
cd audio-karaoke-app
npm init -y
```

### Korak 2: Instalacija ključnih zavisnosti
```bash
cd audio-karaoke-app

# Core zavisnosti
npm install next react react-dom

# AI/ML
npm install onnxruntime-web

# Lokalna pohrana
npm install dexie

# State management
npm install zustand

# Audio processing
npm install soundtouchjs

# Utility
npm install ffmpeg.wasm jszip

# Development
npm install -D typescript @types/react @types/node
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/dexie

# Dodatne alate za razvoj
npm install -D eslint next-eslint-config-prettier prettier
```

### Korak 3: Konfiguriranje TypeScript
Kreiraj `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "isolatedModules": true,
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### Korak 4: Konfiguriranje Next.js
Kreiraj `next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.output.webassemblyModuleFilename =
      isServer ? '../static/wasm/[modulehash].wasm' : 'static/wasm/[modulehash].wasm';

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    config.module.rules.push({
      test: /\.worker\.ts$/,
      loader: 'worker-loader',
    });

    return config;
  },
};

module.exports = nextConfig;
```

### Korak 5: Tailwind CSS setup
```bash
npx tailwindcss init -p
```

Uredi `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

---

## Faza 3: Struktura projekta

### Kreiraj direktorijume
```bash
mkdir -p src/{components,workers,utils,hooks,types,pages,styles}

# Detaljnija struktura
mkdir -p src/components/{AudioUpload,SeparationEngine,Karaoke,PlayerControls,ModelManager,UI}
mkdir -p src/workers
mkdir -p src/utils/{audio,ml,storage}
mkdir -p src/hooks
mkdir -p src/types
mkdir -p public/{models,fonts}
```

### Primjer strukture datoteka
```
audio-karaoke-app/
├── src/
│   ├── pages/
│   │   ├── _app.tsx
│   │   ├── _document.tsx
│   │   └── index.tsx
│   ├── components/
│   │   ├── AudioUpload/
│   │   │   └── AudioUpload.tsx
│   │   ├── SeparationEngine/
│   │   │   └── SeparationEngine.tsx
│   │   ├── Karaoke/
│   │   │   └── KaraokePlayer.tsx
│   │   └── UI/
│   │       ├── Header.tsx
│   │       └── Footer.tsx
│   ├── workers/
│   │   ├── audioSeparationWorker.ts
│   │   └── modelLoaderWorker.ts
│   ├── utils/
│   │   ├── audio/
│   │   │   ├── audioProcessor.ts
│   │   │   └── dsp.ts
│   │   ├── ml/
│   │   │   ├── modelManager.ts
│   │   │   └── inference.ts
│   │   └── storage/
│   │       ├── indexedDBStore.ts
│   │       └── cacheManager.ts
│   ├── hooks/
│   │   ├── useAudioContext.ts
│   │   ├── useSeparation.ts
│   │   ├── useKaraoke.ts
│   │   └── useModelLoader.ts
│   ├── types/
│   │   ├── audio.ts
│   │   ├── model.ts
│   │   └── state.ts
│   └── styles/
│       └── globals.css
├── public/
│   ├── models/
│   └── fonts/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── .env.local
```

---

## Faza 4: Inicijalni setup datoteke

### `src/pages/_app.tsx`
```typescript
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Inicijalizacija globalnih servisa
    console.log('App initialized');
  }, []);

  return <Component {...pageProps} />;
}
```

### `src/pages/index.tsx`
```typescript
import Head from 'next/head';
import AudioUpload from '@/components/AudioUpload/AudioUpload';
import Header from '@/components/UI/Header';

export default function Home() {
  return (
    <>
      <Head>
        <title>Audio Karaoke Separation</title>
        <meta name="description" content="Local audio separation and karaoke app" />
      </Head>
      <main className="min-h-screen bg-gray-900 text-white">
        <Header />
        <AudioUpload />
      </main>
    </>
  );
}
```

### `src/types/audio.ts`
```typescript
export interface AudioBuffer {
  channelData: Float32Array[];
  sampleRate: number;
  duration: number;
}

export interface SeparationResult {
  vocals: AudioBuffer;
  instrumentals: AudioBuffer;
  timestamp: number;
}

export interface ProcessingProgress {
  currentSegment: number;
  totalSegments: number;
  percentage: number;
}

export interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
  startColor?: string;
}
```

### `src/utils/storage/indexedDBStore.ts`
```typescript
import Dexie, { Table } from 'dexie';

export interface CachedAudio {
  id?: number;
  fileHash: string;
  fileName: string;
  vocals: ArrayBuffer;
  instrumentals: ArrayBuffer;
  timestamp: number;
}

export interface CachedModel {
  id?: number;
  modelName: string;
  modelData: ArrayBuffer;
  version: string;
  timestamp: number;
}

export class AudioDB extends Dexie {
  cachedAudio!: Table<CachedAudio>;
  cachedModels!: Table<CachedModel>;

  constructor() {
    super('AudioKaraokeDB');
    this.version(1).stores({
      cachedAudio: '++id, fileHash',
      cachedModels: '++id, modelName',
    });
  }
}

export const db = new AudioDB();
```

---

## Faza 5: Pokretanje razvojnog servera

```bash
# Pokrenite dev server
npm run dev

# Trebalo bi da ispiše:
# > ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

Otvori browser na `http://localhost:3000`

---

## Faza 6: Validacija setup-a

### Checklist
- [ ] Node.js instaliran (`node --version` vraća v18+)
- [ ] npm instaliran (`npm --version` vraća v9+)
- [ ] Next.js projekt kreiran
- [ ] Sve zavisnosti instalirane bez greške
- [ ] Dev server pokrenut bez greške
- [ ] Browser prikazuje pocetnu stranicu
- [ ] VS Code pokazuje TypeScript bez grešaka
- [ ] IndexedDB dostupan u DevTools > Application

---

## Faza 7: Dodatne alate (Opciono)

### ESLint i Prettier
```bash
npm install -D eslint prettier eslint-config-prettier

# Kreiraj .eslintrc.json
echo '{
  "extends": ["next/core-web-vitals", "prettier"]
}' > .eslintrc.json

# Kreiraj .prettierrc
echo '{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}' > .prettierrc
```

### Git setup
```bash
git init
echo "node_modules/
.next/
.env.local
*.log" > .gitignore
git add .
git commit -m "Initial commit"
```

---

## Troubleshooting

### Problem: "WebGPU not available"
**Rješenje**: Koristi Chrome 113+ ili Edge 113+. Za razvoj, koristi --enable-features=Vulkan ili --enable-features=Direct3D12.

### Problem: "Out of Memory"
**Rješenje**: Node.js je iscrpio memoriju. Pokrenite s većom alokacijom:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

### Problem: "Module not found"
**Rješenje**: Provjerite putanju u `tsconfig.json` paths i `next.config.js` resolve.alias.

---

## Sljedeći koraci

1. Kreiraj komponente (AudioUpload, SeparationEngine)
2. Implementiraj Web Workere
3. Integrira ONNX Runtime
4. Testira s test audio datotekama
