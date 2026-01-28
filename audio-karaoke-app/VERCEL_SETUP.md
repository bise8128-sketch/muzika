# Vercel Environment Configuration Guide

This guide explains how to configure environment variables and settings in Vercel for optimal Muzika deployment.

---

## 🔧 Vercel Dashboard Setup (Step-by-Step)

### Step 1: Create a Vercel Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Select your Git repository (GitHub/GitLab/Bitbucket)
3. Choose the repository containing Muzika code
4. Click **Import**

### Step 2: Configure Project Settings

1. **Project Name**
   - Enter: `muzika` (or your preferred name)
   - This becomes your default domain: `https://muzika.vercel.app`

2. **Framework**
   - Vercel auto-detects: **Next.js**

3. **Root Directory**
   - Set to: `audio-karaoke-app/`
   - This is critical since the app is in a subdirectory

4. **Build & Development Settings**
   - Build Command: `next build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

5. Click **Deploy**

---

## 🌍 Environment Variables

### Option A: Set via Vercel Dashboard

1. Go to your project → **Settings** → **Environment Variables**

2. Add the following variables (optional):

```
NEXT_PUBLIC_API_URL = https://muzika.vercel.app/api
NEXT_PUBLIC_ANALYTICS_ID = (your analytics ID if using GA or Plausible)
```

3. Select which environments: **Production**, **Preview**, **Development**

4. Click **Save**

### Option B: Set via `.env.local` (Development Only)

Create `.env.local` in `audio-karaoke-app/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

**Important**: Add `.env.local` to `.gitignore` (already done)

---

## 📊 Vercel Project Settings

### 1. Domains

1. Go to **Settings** → **Domains**
2. Your default domain is auto-assigned: `https://muzika-xxxxx.vercel.app`

To add a custom domain:
```
1. Click "Add" → "Add Domain"
2. Enter your domain (e.g., muzika.example.com)
3. Follow DNS setup instructions
4. Wait for DNS propagation (up to 48 hours)
```

### 2. Git Integration

1. Go to **Settings** → **Git**
2. **Automatic Deployments**
   - ✅ Enabled by default
   - Deploys on every push to `main` branch

3. **Preview Deployments**
   - ✅ Enabled by default
   - Each PR gets a preview URL

4. **Production Branch**
   - Set to: `main` (or your primary branch)

### 3. Build & Development

1. Go to **Settings** → **Build & Development**
2. **Build Command**: `next build`
3. **Output Directory**: `.next`
4. **Install Command**: `npm install`
5. **Node.js Version**: 20.x (recommended)

### 4. Analytics

1. Go to **Analytics** (tab at top)
2. View real-time visitor data
3. Monitor Core Web Vitals (LCP, FID, CLS)
4. Check error rates

### 5. Functions

1. Go to **Settings** → **Functions**
2. **Max Duration**: 300s (Pro plan required for >60s)
3. **Memory**: 3008MB (Pro plan)

---

## 🔒 Security Settings

### 1. Credentials & Tokens

1. Go to **Settings** → **Credentials**
2. Store API keys or tokens (if needed)
3. Reference in environment variables

### 2. CORS & Headers

Vercel respects headers in `vercel.json` and `next.config.ts`:
- ✅ COOP/COEP headers: ✓ Configured
- ✅ Security headers: ✓ Configured
- ✅ CSP: ✓ Configured

### 3. Firewall & DDoS Protection

- ✅ DDoS protection: Enabled by default
- ✅ Web Application Firewall: Available on Enterprise

---

## 📈 Monitoring & Analytics

### Real Experience Scores (RES)

1. Go to **Analytics** → **Real Experience Scores**
2. Monitor user performance metrics:
   - **LCP** (Largest Contentful Paint): < 2.5s ✓
   - **FID** (First Input Delay): < 100ms ✓
   - **CLS** (Cumulative Layout Shift): < 0.1 ✓

### Deployments

1. Go to **Deployments** tab
2. View deployment history
3. Rollback to previous versions if needed
4. Check logs for errors

### Edge Functions (Advanced)

If using API routes, they auto-scale on Vercel:
- **Hobby**: 60s timeout
- **Pro**: 300s timeout
- **Enterprise**: Custom

---

## 🚀 Deployment Triggers

### Automatic Deployments

Every push to your main branch triggers a deployment:

```bash
git add .
git commit -m "Update audio-karaoke-app"
git push origin main
# Vercel automatically deploys!
```

### Manual Deployments

Via Vercel CLI:
```bash
vercel --prod
```

Via Dashboard:
1. Go to **Deployments**
2. Click **"⋮"** (three dots) on any deployment
3. Click **"Redeploy"**

---

## ⚠️ Limitations & Quotas

### Hobby Plan (Free)

| Limit | Value |
|-------|-------|
| Deployments/month | Unlimited |
| Function execution time | 60s |
| Function memory | 128MB |
| Static file size | 100MB |
| Bandwidth | 100GB/month |
| Custom domain | Not included |

### Pro Plan ($20/month)

| Limit | Value |
|-------|-------|
| Deployments/month | Unlimited |
| Function execution time | 300s |
| Function memory | 3008MB |
| Static file size | 2GB |
| Bandwidth | Unlimited |
| Custom domain | ✓ Included |
| Team members | Unlimited |

### For Muzika Specifically

| Requirement | Hobby | Pro |
|-------------|-------|-----|
| WebGPU/WASM support | ✓ | ✓ |
| ONNX models (<150MB) | ✓ | ✓ |
| ONNX models (>150MB) | ✗ | ✓ |
| Audio separation | ✓ (client-side) | ✓ |
| Caching | ✓ (IndexedDB) | ✓ |

**If models exceed 100MB and you're on Hobby plan**, either:
1. Upgrade to Pro ($20/month)
2. Host models on external CDN
3. Use INT8 quantization to reduce size

---

## 🔄 Advanced Configuration

### 1. Preview Deployments

Every pull request gets a preview URL:
- Automatically deployed
- Merged to production on PR approval

### 2. Rollbacks

To revert to a previous deployment:
1. Go to **Deployments**
2. Click on a previous deployment
3. Click **"⋮"** → **"Promote to Production"**

### 3. Environment-Specific Variables

Set different values for **Production**, **Preview**, **Development**:
1. Go to **Settings** → **Environment Variables**
2. Select environment from dropdown
3. Set variable

### 4. Redirects & Rewrites

Add to `vercel.json`:
```json
{
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ]
}
```

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Deployment fails with "vercel.json not found"
- **Solution**: Ensure `vercel.json` is in root directory (`audio-karaoke-app/`)

**Issue**: Build timeout (>1 hour)
- **Solution**: Check for infinite loops, heavy dependencies, or large files

**Issue**: WebGPU errors in production
- **Solution**: Verify COOP/COEP headers in `vercel.json` are set correctly

**Issue**: Models not loading (Hobby plan)
- **Solution**: Models must be < 100MB. Upgrade to Pro or use CDN.

### Getting Help

- **Vercel Status**: https://www.vercelstatus.com/
- **Vercel Support**: https://vercel.com/support
- **Documentation**: https://vercel.com/docs
- **Community**: https://github.com/vercel/next.js/discussions

---

## ✅ Final Checklist

- [ ] Vercel account created
- [ ] Repository connected to Vercel
- [ ] Root directory set to `audio-karaoke-app/`
- [ ] Build settings configured
- [ ] Environment variables added (if needed)
- [ ] First deployment completed
- [ ] App loads at `https://<project-name>.vercel.app`
- [ ] Audio separation tested
- [ ] Custom domain configured (optional)
- [ ] Analytics dashboard monitored

---

**Your Muzika app is now live on Vercel! 🎉**

Share your deployment URL and start using it immediately!
