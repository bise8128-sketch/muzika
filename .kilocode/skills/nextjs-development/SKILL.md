---
name: nextjs-development
description: Develop and maintain the Muzika Next.js application. Use when user asks to add features, fix bugs, or work with the Next.js app router, API routes, or React components.
metadata:
  category: development
  source:
    repository: https://github.com/kilo-code/skills
    path: nextjs-development
---

# Next.js Development

Develop and maintain the Muzika karaoke application built with Next.js 14+.

## Project Structure

```
audio-karaoke-app/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── [locale]/ # Internationalized routes
│   │   ├── api/      # API routes
│   │   └── *.tsx    # Pages
│   ├── components/  # React components
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility libraries
│   ├── utils/        # Helper functions
│   ├── types/        # TypeScript types
│   └── state/        # State management
├── public/           # Static assets
│   ├── wasm/         # ONNX Runtime WASM files
│   ├── ffmpeg/       # FFmpeg WASM
│   └── models/       # ML models
└── prisma/           # Database schema
```

## Quick Start

### Development Server

```bash
cd audio-karaoke-app
npm run dev
```

The app runs on `http://localhost:3000` with locale routing (e.g., `/en`, `/bs`).

### Build for Production

```bash
npm run build
npm start
```

## Key Technologies

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: XState (state machines)
- **i18n**: next-intl
- **Database**: Prisma with SQLite (local) / PostgreSQL (production)

## Common Tasks

### Adding a New Page

1. Create route in `src/app/[locale]/`:
```tsx
// src/app/[locale]/new-feature/page.tsx
export default function NewFeaturePage() {
  return <div>New Feature</div>;
}
```

### Adding an API Route

1. Create in `src/app/api/`:
```ts
// src/app/api/my-endpoint/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ data: 'example' });
}
```

### Adding a Component

1. Create in appropriate folder under `src/components/`:
```tsx
// src/components/UI/MyComponent.tsx
export function MyComponent() {
  return <div>Component</div>;
}
```

### Using Custom Hooks

```tsx
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useModels } from '@/hooks/useModels';

function MyComponent() {
  const { isPlaying, play, pause } = useAudioEngine();
  const { models, loadModel } = useModels();
  
  return <button onClick={isPlaying ? pause : play}>
    {isPlaying ? 'Pause' : 'Play'}
  </button>;
}
```

## API Routes

| Route | Description |
|-------|-------------|
| `/api/models` | List available ML models |
| `/api/proxy-model` | Proxy model files |
| `/api/python-processing` | Server-side audio processing |
| `/api/extract-youtube` | YouTube audio extraction |
| `/api/backend-upload` | Upload files to backend |
| `/api/backend-library` | Access server library |

## Environment Variables

```env
# Backend
BACKEND_URL=http://localhost:8000
DATABASE_URL=file:./dev.db

# Authentication (optional)
AUTH_SECRET=your-secret
```

## TypeScript Conventions

- Use strict TypeScript mode
- Define types in `src/types/`
- Use interfaces for object shapes
- Avoid `any` types

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type checking
npm run type-check
```

## Troubleshooting

### Build Errors

1. Clear `.next` cache: `rm -rf .next`
2. Delete node_modules and reinstall: `rm -rf node_modules && npm install`

### Runtime Errors

- Check browser console for errors
- Verify environment variables
- Check API route responses with `curl`

### Performance Issues

- Use Chrome DevTools Performance tab
- Check WebGPU availability
- Monitor IndexedDB usage
