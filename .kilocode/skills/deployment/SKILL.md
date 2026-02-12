---
name: deployment
description: Deploy and manage the Muzika karaoke application. Use when user asks to deploy, host, or set up the application on Vercel, Netlify, or other platforms.
metadata:
  category: devops
  source:
    repository: https://github.com/kilo-code/skills
    path: deployment
---

# Deployment

Deploy and manage the Muzika karaoke application on various hosting platforms.

## Supported Platforms

- **Vercel** (Recommended)
- **Netlify**
- **Docker**
- **Node.js Server**

## Vercel Deployment (Recommended)

### Quick Deploy

```bash
cd audio-karaoke-app
npm i -g vercel
vercel
```

### Production Deploy

```bash
vercel --prod
```

### Environment Variables

Set these in Vercel dashboard:

```
BACKEND_URL=https://your-backend.vercel.app
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXT_PUBLIC_API_URL=/api
```

### Vercel Configuration

The app uses `vercel.json` for configuration:

```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }
  ]
}
```

## Netlify Deployment

### Quick Deploy

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=audio-karaoke-app/.next
```

### Configuration

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "audio-karaoke-app/.next"

[[redirects]]
  from = "/api/*"
  to = "/api/:splat"
  status = 200
```

## Docker Deployment

### Build Docker Image

```bash
cd audio-karaoke-app
docker build -t muzika-karaoke .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e BACKEND_URL=http://localhost:8000 \
  muzika-karaoke
```

### Docker Compose

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - BACKEND_URL=http://backend:8000
  backend:
    build: ../python-audio-cli
    ports:
      - "8000:8000"
```

## Backend Deployment

The Python backend needs separate deployment:

### Local Development

```bash
cd python-audio-cli
pip install -r requirements.txt
python api.py
```

### Production

```bash
# Using gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker api:app

# Using Docker
docker build -t muzika-backend .
docker run -p 8000:8000 muzika-backend
```

## Environment-Specific Configuration

### Development

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
BACKEND_URL=http://localhost:8000
NODE_ENV=development
```

### Production

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
BACKEND_URL=https://your-backend.com
NODE_ENV=production
```

## Troubleshooting

### Build Failures

1. Clear `.next` cache: `rm -rf .next`
2. Check TypeScript errors: `npm run type-check`
3. Verify all dependencies installed

### Runtime Errors

- Check Vercel/Netlify function logs
- Verify environment variables
- Check browser console for errors

### CORS Issues

- Configure CORS in API routes
- Use Next.js API routes as proxy

### WebGPU Not Working

- Deploy to Vercel Pro for better browser support
- Ensure HTTPS is enabled
- Check browser compatibility

## Performance Optimization

### Edge Functions

Use Edge runtime for faster responses:

```typescript
export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ fast: true });
}
```

### Caching

Configure ISR for static content:

```typescript
export const revalidate = 3600; // 1 hour
```

### Large Files

Serve WASM/Models from CDN:
- Upload to Vercel blob storage
- Or use Cloudflare R2
