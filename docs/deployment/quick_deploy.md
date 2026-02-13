# Quick Deployment Commands

## 🚀 Deploy to Vercel (Recommended)

### Option 1: Using Vercel CLI (Fastest)

```bash
# Install Vercel CLI globally (one-time only)
npm install -g vercel

# Navigate to the app directory
cd /home/k/Downloads/muzika/audio-karaoke-app

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

**First deployment prompts:**
- Project name: `muzika` (or your preferred name)
- Directory for code: Choose default (current directory)
- Framework: Automatically detected as Next.js
- Build command: Use default (`next build`)
- Output directory: Use default (`.next`)

### Option 2: Using Vercel Dashboard (GUI)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Sign in with GitHub/GitLab/Bitbucket
3. Select your repository containing the Muzika code
4. Import project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `audio-karaoke-app/`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
5. Click **Deploy** and wait for build completion
6. Your app will be live at `https://<project-name>.vercel.app`

### Option 3: Using Git (GitHub + Vercel Integration)

1. Push code to GitHub:
```bash
cd /home/k/Downloads/muzika
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

2. Connect repository to Vercel:
   - Visit [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Set **Root Directory** to `audio-karaoke-app/`
   - Click **Deploy**

3. Every push to `main` will trigger automatic deployment

---

## 🐳 Deploy with Docker (Self-Hosted)

### Build Docker Image

```bash
cd /home/k/Downloads/muzika/audio-karaoke-app
docker build -t muzika-app:latest .
```

### Run Locally

```bash
docker run -p 3000:3000 muzika-app:latest
```

Visit [http://localhost:3000](http://localhost:3000)

### Push to Container Registry

#### DockerHub
```bash
docker tag muzika-app:latest <YOUR_USERNAME>/muzika-app:latest
docker login
docker push <YOUR_USERNAME>/muzika-app:latest
```

#### Google Container Registry (GCR)
```bash
docker tag muzika-app:latest gcr.io/<YOUR_PROJECT>/muzika-app:latest
gcloud auth configure-docker
docker push gcr.io/<YOUR_PROJECT>/muzika-app:latest
```

#### AWS ECR
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <YOUR_AWS_ID>.dkr.ecr.us-east-1.amazonaws.com
docker tag muzika-app:latest <YOUR_AWS_ID>.dkr.ecr.us-east-1.amazonaws.com/muzika-app:latest
docker push <YOUR_AWS_ID>.dkr.ecr.us-east-1.amazonaws.com/muzika-app:latest
```

### Deploy with Docker Compose

```bash
cd /home/k/Downloads/muzika/audio-karaoke-app
docker-compose up -d
```

---

## 📋 Pre-Deployment Verification

### 1. Run Local Build Test

```bash
cd /home/k/Downloads/muzika/audio-karaoke-app
npm run build
```

✅ **Expected output**: `✓ Compiled successfully`

### 2. Test Production Build Locally

```bash
npm run start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run Tests

```bash
npm run test
npm run lint
```

### 4. Check Bundle Size

```bash
npm run analyze
```

---

## 🔒 Environment Variables (Vercel Dashboard)

If needed, add to **Settings → Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

---

## ✅ Deployment Checklist

- [ ] Run `npm run build` successfully
- [ ] Run `npm run test` and all tests pass
- [ ] Run `npm run lint` with no critical errors
- [ ] Verify `.env.local` is in `.gitignore`
- [ ] Confirm all WASM files are in `public/wasm/`
- [ ] Check `vercel.json` is present in `audio-karaoke-app/`
- [ ] Verify WebGPU headers are set in `next.config.ts`
- [ ] Test with Chrome 113+ (WebGPU support)

---

## 📊 Post-Deployment Verification

After deployment:

1. **Open your deployed URL** and verify the app loads
2. **Test audio separation**:
   - Upload a test audio file
   - Wait for model to download (first time only)
   - Verify separation completes
   - Download separated audio
3. **Check network headers** (Chrome DevTools → Network):
   - Verify `Cross-Origin-Opener-Policy: same-origin`
   - Verify `Cross-Origin-Embedder-Policy: require-corp`
4. **Monitor Vercel Dashboard** for errors/warnings

---

## 🚨 Troubleshooting

### Build Fails with WASM Error
```bash
# Clear build cache and rebuild
rm -rf .next
npm run build
```

### Model Download Timeout
- First download (80-300MB) may take 2-5 minutes depending on network speed
- Subsequent uploads will use cached model (instant)

### WebGPU Not Available
- Ensure Chrome 113+, Edge 113+, or Safari 17.2+
- Enable in `chrome://flags#enable-unsafe-webgpu`

### Out of Memory (Vercel Pro required for large files)
- Upgrade to Vercel Pro plan ($20/month) for increased memory
- Or use Hobby plan and limit uploads to <100MB

---

## 📞 Support

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **ONNX Runtime**: https://onnxruntime.ai/
- **WebGPU**: https://gpuweb.github.io/gpuweb/

---

**Your Muzika app is ready for production deployment! 🎉**
