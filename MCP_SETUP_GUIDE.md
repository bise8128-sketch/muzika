# MCP Servers Configuration Guide

## Overview
Your `mcp_config.json` has been updated with 8 MCP servers optimized for the Muzika audio karaoke application. This guide walks you through configuring required credentials and verifying functionality.

---

## Installed MCP Servers

### 1. **Upstash Context7 MCP** ✅
- **Status**: Already configured
- **Purpose**: Upstash integration for context management
- **No action needed**

### 2. **GitHub** ⚠️ ACTION REQUIRED
- **Purpose**: Access TRvlvr/model_repo for ONNX model management, versioning, and releases
- **Setup**:
  1. Visit [github.com/settings/tokens/new](https://github.com/settings/tokens/new)
  2. Create a **Personal Access Token (PAT)** with these scopes:
     - ✅ `repo` (full repository access)
     - ✅ `read:org` (read organization data)
  3. Copy the token value
  4. Update `mcp_config.json`:
     ```json
     "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
     ```
  5. **Security Best Practice**: For production, use fine-grained tokens limited to `TRvlvr/model_repo` repository only

### 3. **Filesystem** ✅
- **Status**: Already configured
- **Purpose**: Access and manage project files at `/home/k/Downloads/muzika`
- **No action needed**

### 4. **Brave Search** ⚠️ ACTION REQUIRED
- **Purpose**: Search for ONNX models, audio processing libraries, and ML documentation
- **Setup**:
  1. Visit [api.search.brave.com](https://api.search.brave.com)
  2. Sign up for free API key
  3. Copy your API key
  4. Update `mcp_config.json`:
     ```json
     "BRAVE_SEARCH_API_KEY": "YOUR_BRAVE_API_KEY_HERE"
     ```

### 5. **Docker** ✅
- **Status**: Ready (requires Docker daemon running locally)
- **Purpose**: Build/manage containers for deployment, testing environments, and CI/CD
- **Verify**: Run `docker ps` to ensure Docker daemon is running
- **Usage**: Build containerized versions of Muzika for production deployment

### 6. **Puppeteer** ✅
- **Status**: Ready (installs Chromium automatically)
- **Purpose**: Automate browser testing and UI interaction testing beyond Playwright
- **Usage**: Programmatic browser control for advanced E2E testing scenarios

### 7. **Node.js** ✅
- **Status**: Ready
- **Purpose**: Execute Node.js scripts, build operations, FFmpeg WASM compilation
- **Usage**: Optimize WASM modules, manage npm dependencies, custom build scripts

### 8. **FFmpeg** ✅
- **Status**: Ready (requires FFmpeg binary in PATH)
- **Purpose**: Audio format conversion, batch processing, optimization for karaoke rendering
- **Verify**: Run `ffmpeg -version` in terminal
- **Usage**: Advanced audio processing, CD+G graphics optimization, audio codec conversion

---

## Configuration Checklist

```
[ ] 1. Set GITHUB_PERSONAL_ACCESS_TOKEN in mcp_config.json
[ ] 2. Set BRAVE_SEARCH_API_KEY in mcp_config.json
[ ] 3. Verify Docker is installed: docker --version
[ ] 4. Verify FFmpeg is installed: ffmpeg -version
[ ] 5. Test MCP connectivity: npm run dev (should load all MCPs)
```

---

## Using MCPs in Your Workflow

### GitHub Integration
```javascript
// Access TRvlvr/model_repo for latest ONNX models
const models = await github.getRepositoryReleases('TRvlvr/model_repo');
const latestModel = models[0]; // Get latest MDX-Net/Demucs release
```

### FFmpeg for Audio Processing
```bash
# Batch convert audio files
ffmpeg -i input.wav -c:a libopus -b:a 128k output.opus

# Extract audio for karaoke separation
ffmpeg -i song.mp3 -acodec pcm_s16le -ar 44100 song_pcm.wav
```

### Docker for Deployment
```bash
# Build Muzika container
docker build -t muzika:latest .

# Run with GPU support
docker run --gpus all -p 3000:3000 muzika:latest
```

### Brave Search for Model Discovery
```javascript
// Search for latest audio separation models
const results = await braveSearch.search('ONNX audio separation models 2026');
```

### Node for Custom Build Scripts
```javascript
// Optimize WASM modules
const { execSync } = require('child_process');
execSync('wasm-opt -O4 onnxruntime.wasm -o onnxruntime.optimized.wasm');
```

---

## Troubleshooting

### MCP Server Won't Connect
- **Check**: Environment variables are set correctly in `mcp_config.json`
- **Check**: Required binaries are installed (Docker, FFmpeg)
- **Check**: API keys are valid and have not expired
- **Test**: `npm run dev` and check browser console for MCP errors

### GitHub Token Issues
- Ensure token has not expired
- Verify token has `repo` scope
- Check that token is not revoked in GitHub Settings

### Docker Issues
- Start Docker daemon: `sudo dockerd` (Linux) or open Docker Desktop (Mac/Windows)
- Verify: `docker ps` returns running containers list

### FFmpeg Issues
- Install: `sudo apt-get install ffmpeg` (Linux), `brew install ffmpeg` (Mac), or download from ffmpeg.org
- Verify: `which ffmpeg` should show the path

---

## Next Steps

1. **Configure Credentials**: Add GitHub PAT and Brave API key to `mcp_config.json`
2. **Start Development Server**: `npm run dev` from `audio-karaoke-app/` directory
3. **Verify MCPs**: Check that all MCPs load successfully without errors
4. **Model Management**: Use GitHub MCP to monitor TRvlvr/model_repo for new ONNX models
5. **Deployment**: Use Docker MCP to containerize Muzika for production

---

## Reference Documentation
- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Brave Search API](https://api.search.brave.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
