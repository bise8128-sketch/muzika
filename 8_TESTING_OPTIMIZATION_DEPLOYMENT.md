# Testing, Optimization & Deployment Guide

## 1. Testing Strategy

### Unit Testing

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom ts-jest
```

**File: `jest.config.js`**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

**File: `src/utils/__tests__/audioProcessor.test.ts`**

```typescript
import { decodeAudioFile, segmentAudio } from '../audio/audioProcessor';

describe('Audio Processor', () => {
  it('should decode WAV file', async () => {
    const file = new File([/* WAV data */], 'test.wav');
    const buffer = await decodeAudioFile(file);

    expect(buffer.sampleRate).toBe(44100);
    expect(buffer.duration).toBeGreaterThan(0);
  });

  it('should segment audio correctly', () => {
    const mockAudioBuffer = {
      sampleRate: 44100,
      channelData: [new Float32Array(44100 * 30)], // 30 sekundi
    };

    const segments = segmentAudio(mockAudioBuffer, 10); // 10-sekundni segmenti
    expect(segments.length).toBe(3); // 30 / 10 = 3
  });
});
```

### E2E Testing

```bash
npm install -D cypress @cypress/schematic
npx cypress init
```

**File: `cypress/e2e/separation.cy.ts`**

```typescript
describe('Audio Separation Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000');
  });

  it('should upload and separate audio', () => {
    // Upload file
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-audio.mp3');

    // Wait for separation to complete
    cy.get('[data-testid="separation-progress"]')
      .should('have.text', '100%')
      .timeout(60000);

    // Check results exist
    cy.get('[data-testid="vocals-player"]').should('exist');
    cy.get('[data-testid="instrumentals-player"]').should('exist');

    // Download vocals
    cy.get('[data-testid="download-vocals"]').click();
    cy.readFile('cypress/downloads/vocals.wav').should('exist');
  });

  it('should use cache on second upload', () => {
    // First upload
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-audio.mp3');
    cy.get('[data-testid="separation-progress"]').should('have.text', '100%');

    const firstTime = new Date();

    // Second upload (same file)
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-audio.mp3');
    cy.get('[data-testid="separation-progress"]').should('have.text', '100%');

    const secondTime = new Date();

    // Trebalo bi biti značajno brže (cache)
    expect(secondTime.getTime() - firstTime.getTime()).toBeLessThan(1000);
  });
});
```

### Performance Testing

```typescript
// File: src/utils/__tests__/performance.test.ts

import { separateAudio } from '@/utils/ml/inference';

describe('Performance Benchmarks', () => {
  it('should separate 2-minute audio in < 2 minutes on GPU', async () => {
    const audioFile = createMockAudio(120); // 2 minuta

    const startTime = performance.now();
    const result = await separateAudio(audioFile, { gpuAcceleration: true });
    const elapsedTime = performance.now() - startTime;

    console.log(`Separation time: ${(elapsedTime / 1000).toFixed(2)}s`);
    expect(elapsedTime).toBeLessThan(120000); // 2 minuta
  }, 300000); // 5 minuta timeout
});
```

---

## 2. Monitoring & Debugging

### Performance Monitoring

```typescript
// File: src/utils/monitoring/performanceMonitor.ts

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  mark(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }

      this.metrics.get(label)!.push(duration);

      // Log ako je sporije od threshold-a
      if (duration > 1000) {
        console.warn(`⚠️  ${label} took ${duration.toFixed(0)}ms`);
      }
    };
  }

  getReport(): string {
    let report = '📊 Performance Report\n';
    report += '─'.repeat(50) + '\n';

    for (const [label, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);

      report += `${label}\n`;
      report += `  Avg: ${avg.toFixed(2)}ms | Min: ${min.toFixed(2)}ms | Max: ${max.toFixed(2)}ms\n`;
    }

    return report;
  }

  sendToAnalytics(): void {
    // Pošalji metrics na analytics servis
    const metrics = Object.fromEntries(this.metrics);
    console.log('Sending metrics:', metrics);
    // fetch('/api/metrics', { method: 'POST', body: JSON.stringify(metrics) })
  }
}

export const monitor = new PerformanceMonitor();
```

### Error Tracking

```typescript
// File: src/utils/monitoring/errorTracker.ts

export interface ErrorLog {
  timestamp: number;
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

export class ErrorTracker {
  private errors: ErrorLog[] = [];
  private maxErrors = 100;

  logError(error: Error | string, context?: Record<string, any>): void {
    const errorLog: ErrorLog = {
      timestamp: Date.now(),
      type: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };

    this.errors.push(errorLog);

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    console.error('🔴 Error logged:', errorLog);

    // Pošalji na error tracking servis (Sentry, etc.)
    // this.sendToErrorTracking(errorLog);
  }

  getRecentErrors(count: number = 10): ErrorLog[] {
    return this.errors.slice(-count);
  }

  clearErrors(): void {
    this.errors = [];
  }
}

export const errorTracker = new ErrorTracker();
```

### Setup Global Error Handler

```typescript
// File: src/pages/_app.tsx

import { errorTracker } from '@/utils/monitoring/errorTracker';

useEffect(() => {
  // Catch unhandled promise rejections
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    errorTracker.logError(event.reason, { type: 'unhandledRejection' });
  };

  // Catch unhandled errors
  const handleError = (event: ErrorEvent) => {
    errorTracker.logError(event.error, { type: 'uncaughtError' });
  };

  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('error', handleError);

  return () => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    window.removeEventListener('error', handleError);
  };
}, []);
```

---

## 3. Optimizacija performansi

### Code Splitting

```typescript
// File: src/pages/index.tsx

import dynamic from 'next/dynamic';

const SeparationEngine = dynamic(
  () => import('@/components/SeparationEngine/SeparationEngine'),
  { loading: () => <div>Loading...</div> }
);

export default function Home() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <SeparationEngine />
      </Suspense>
    </main>
  );
}
```

### Image & Font Optimization

```typescript
// next.config.js

module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },
};
```

```typescript
// src/pages/_document.tsx

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Preload critical fonts */}
        <link
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          rel="preload"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

### Memory Optimization

```typescript
// Koristi WeakMap za cache-iranje bez memory leak-a
const modelCache = new WeakMap<object, any>();

// Eksplicitno briši bufere kada završiš
function cleanup(audioBuffer: AudioBuffer) {
  // AudioBuffer je read-only, ali možeš osloboditi reference
  audioBuffer = null;
}
```

---

## 4. Security Best Practices

```typescript
// File: src/utils/security/validators.ts

export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
  const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'];

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large (max 500MB)' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Unsupported file type' };
  }

  // Provjeri magic bytes (file signature)
  return validateMagicBytes(file);
}

function validateMagicBytes(file: File): { valid: boolean; error?: string } {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target?.result as ArrayBuffer);

      // Check WAV signature (RIFF....WAVE)
      const isWAV =
        bytes[0] === 0x52 && // 'R'
        bytes[1] === 0x49 && // 'I'
        bytes[2] === 0x46 && // 'F'
        bytes[3] === 0x46; // 'F'

      // Check MP3 signature (ID3 ili FF FB)
      const isMP3 =
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
        (bytes[0] === 0xff && bytes[1] === 0xfb); // MPEG

      if (isWAV || isMP3) {
        resolve({ valid: true });
      } else {
        resolve({ valid: false, error: 'Invalid audio file format' });
      }
    };

    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}
```

---

## 5. Deployment

### Vercel Deployment

```bash
# Instaliraj Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

**File: `vercel.json`**

```json
{
  "env": {
    "NEXT_PUBLIC_API_URL": "@api_url"
  },
  "functions": {
    "pages/**": {
      "maxDuration": 300
    }
  },
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

### Docker Deployment

**File: `Dockerfile`**

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
```

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    volumes:
      - ./logs:/app/logs

  # Opciono: nginx reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
```

### Self-Hosted Deployment

```bash
# 1. SSH na server
ssh user@your-server.com

# 2. Kloniraj repo
git clone https://github.com/yourrepo/audio-karaoke-app.git
cd audio-karaoke-app

# 3. Instaliraj dependencies
npm ci

# 4. Build
npm run build

# 5. Pokreni
npm start

# 6. Setup PM2 za auto-restart
npm install -g pm2
pm2 start npm --name "audio-karaoke" -- start
pm2 startup
pm2 save
```

---

## 6. CI/CD Setup (GitHub Actions)

**File: `.github/workflows/ci.yml`**

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

      - name: Test
        run: npm run test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          production: true
```

---

## 7. Monitoring Production

### Health Check Endpoint

```typescript
// File: src/pages/api/health.ts

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
}
```

### Logging

```typescript
// File: src/utils/logger.ts

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  static log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${LogLevel[level]}]`;

    if (process.env.NODE_ENV === 'production') {
      // Pošalji na logging servis (Datadog, CloudWatch, etc.)
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`, data);
    }
  }

  static info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  static warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  static error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }
}
```

---

## 8. Checklist za Production Launch

- [ ] Sve testove prolaze
- [ ] Performance benchmarks zadovoljavaju
- [ ] Security audit završen
- [ ] Error tracking setup (Sentry ili slično)
- [ ] Logging implementiran
- [ ] Analytics setup
- [ ] HTTPS/SSL certificate
- [ ] CORS policies konfiguriran
- [ ] Rate limiting setup
- [ ] Backup strategy
- [ ] Documentation completed
- [ ] User testing completed
- [ ] Privacy policy i ToS posted

