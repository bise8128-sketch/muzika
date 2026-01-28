# Deployment Guide - Muzika Audio Karaoke App

This guide covers deploying Muzika to Vercel and alternative hosting options.

---

## 🚀 Vercel Deployment (Recommended)

Vercel is the optimal hosting platform for Next.js 14 applications with WebGPU and WebAssembly support.

### Prerequisites
- Vercel account (free tier available at [vercel.com](https://vercel.com))
- Git repository (GitHub, GitLab, or Bitbucket)
- Node.js 18+ installed locally

### Step 1: Push Code to Git Repository

```bash
cd /home/k/Downloads/muzika
git init
git add .
git commit -m "Initial commit: Muzika audio karaoke app"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/muzika.git
git push -u origin main
```

### Step 2: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 3: Deploy from CLI (Quick)

```bash
cd audio-karaoke-app
vercel --prod
```

Follow the prompts:
- **Project name**: `muzika` (or your preferred name)
- **Root directory**: Select `audio-karaoke-app`
- **Build command**: Keep default (`next build`)
- **Output directory**: Keep default (`.next`)
- **Install command**: Keep default (`npm install`)

Vercel will detect this is a Next.js project and configure automatically.

### Step 4: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select your Git repository
3. Set **Root Directory** to `audio-karaoke-app/`
4. Framework: Select **Next.js**
5. Click **Deploy**

Vercel will automatically build and deploy your app.

---

## 📋 Deployment Configuration

### vercel.json

The `vercel.json` file contains production settings:

```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "headers": [
    {
      "source": "/:path*",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        }
      ]
    },
    {
      "source": "/public/models/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "functions": {
    "src/app/api/**": {
      "maxDuration": 300,
      "memory": 3008
    }
  }
}
```

**Key Settings**:
- **COOP/COEP Headers**: Enable `SharedArrayBuffer` for WebGPU and WASM threads
- **Cache-Control**: ONNX models cached for 1 year (immutable)
- **maxDuration**: API functions timeout after 300s (Pro plan limit)

### Important Security Headers

- **Cross-Origin-Opener-Policy: same-origin** - Allows `SharedArrayBuffer`
- **Cross-Origin-Embedder-Policy: require-corp** - Requires cross-origin resources to opt-in
- **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing
- **X-Frame-Options: SAMEORIGIN** - Prevents clickjacking

---

## 🔧 Environment Variables

### Public Variables (Safe to Expose)
- `NEXT_PUBLIC_API_URL` - API endpoint for model proxying (if needed)
- `NEXT_PUBLIC_ANALYTICS_ID` - Google Analytics or Plausible ID (optional)

### Private Variables (Kept Secret)
- `DATABASE_URL` - Only if using server-side database (not required for current setup)

**To Set Variables in Vercel Dashboard**:
1. Go to your project settings
2. Navigate to **Settings → Environment Variables**
3. Add variables for Production, Preview, and Development environments

---

## 📦 Model Size Considerations

### Vercel Plan Limits

| Plan | Max File Size | Bandwidth | Price |
|------|---------------|-----------|-------|
| Hobby | 100MB | 100GB/month | Free |
| Pro | 2GB | Unlimited | $20/month |
| Enterprise | Custom | Custom | Custom |

### If Models Exceed 100MB (Hobby Plan)

**Option 1: Upgrade to Pro Plan** ($20/month)
- Supports files up to 2GB
- Unlimited bandwidth
- Priority support

**Option 2: Host Models on External CDN**
- Use Cloudflare R2, AWS S3, or Google Cloud Storage
- Update model URL in `src/utils/ml/modelDownloader.ts`
- Example:
  ```typescript
  const MODEL_URL = process.env.NEXT_PUBLIC_MODEL_URL ||
    'https://cdn.example.com/models/mdx-net-v1.onnx';
  ```

**Option 3: Use Git LFS (Large File Storage)**
- Store models in Git LFS
- Requires Git LFS installation
- Note: Vercel may incur additional charges

---

## ✅ Pre-Deployment Checklist

- [ ] Run `npm run build` locally and verify success
- [ ] Run `npm run lint` to check for code issues
- [ ] Run `npm run test` to ensure tests pass
- [ ] Verify `.env.local` is in `.gitignore`
- [ ] Check that all WASM files are in `public/wasm/`
- [ ] Ensure `src/app/api/` routes don't exceed 300s execution time
- [ ] Test WebGPU support: https://your-deployed-app.vercel.app/ in Chrome 113+
- [ ] Verify cross-origin headers with DevTools Network tab

---

## 🐳 Docker Deployment (Alternative)

For self-hosted deployments or containerized environments.

### Build Docker Image

```bash
cd audio-karaoke-app
docker build -t muzika-app:latest .
```

### Run Container Locally

```bash
docker run -p 3000:3000 muzika-app:latest
```

### Deploy to Container Registry

```bash
# DockerHub
docker tag muzika-app:latest <YOUR_DOCKERHUB_USERNAME>/muzika-app:latest
docker login
docker push <YOUR_DOCKERHUB_USERNAME>/muzika-app:latest

# Or use Google Container Registry, AWS ECR, etc.
```

### Deploy with Docker Compose

```bash
docker-compose up -d
```

See `docker-compose.yml` for full configuration.

---

## 🔍 Testing Production Build Locally

```bash
cd audio-karaoke-app

# Build the app
npm run build

# Start production server
npm run start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📊 Monitoring & Analytics

### Vercel Analytics (Built-in)

- **Real Experience Scores (RES)**: Measures actual user performance
- **Core Web Vitals**: LCP, FID, CLS tracking
- Visit [vercel.com/analytics](https://vercel.com/analytics)

### Application Performance Monitoring (APM)

Optional integrations:
- **Sentry**: Error tracking and performance monitoring
- **LogRocket**: User session replay
- **Datadog**: Full-stack monitoring

---

## 🚨 Troubleshooting

### WebGPU Not Available

**Issue**: "WebGPU is not supported on this browser"

**Solution**:
- Ensure Chrome 113+, Edge 113+, or Safari 17.2+
- Enable flag: `chrome://flags#enable-unsafe-webgpu`
- Use Chrome Canary for latest features

### Large Model Download Timeout

**Issue**: "Failed to load model"

**Solution**:
- Check network speed (models are 80-300MB)
- Use cache after first download
- Consider INT8 quantization
- Host model on CDN with faster speeds

### Out of Memory Error

**Issue**: "JavaScript heap out of memory"

**Solution**:
- Reduce audio chunk size from 30s to 15s
- Increase Node memory: `NODE_OPTIONS="--max-old-space-size=4096"`
- Use Vercel Pro plan with higher memory allocation

### SharedArrayBuffer Errors

**Issue**: "Cannot construct a SharedArrayBuffer"

**Solution**:
- Verify COOP/COEP headers are present in DevTools
- Ensure all cross-origin resources set CORP header
- Use Chrome 113+ (older browsers may have limitations)

---

## 🔐 Security Best Practices

1. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm update
   ```

2. **Set Environment Variables Securely**
   - Use Vercel dashboard, never hardcode secrets

3. **Enable HTTPS** (automatic on Vercel)

4. **Content Security Policy** (configured in vercel.json)

5. **Monitor for Vulnerabilities**
   - GitHub Security Alerts
   - npm audit
   - Snyk integration

---

## 📞 Support & Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **WebGPU Spec**: https://gpuweb.github.io/gpuweb/
- **ONNX Runtime Web**: https://github.com/microsoft/onnxruntime/tree/main/js/web

---

## 🎉 Deployment Complete!

Your Muzika app is now live on Vercel. Share the URL with friends and enjoy!

**Default Vercel URL**: `https://muzika-[random].vercel.app`

To use a custom domain:
1. Go to **Settings → Domains** in Vercel dashboard
2. Add your custom domain
3. Follow DNS setup instructions
