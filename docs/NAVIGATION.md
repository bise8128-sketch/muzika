# 📚 Muzika — Documentation Navigation

> **All project documentation in one place.**  
> Last Updated: February 2026

---

## 🚀 Getting Started

| Document | Description |
|---------|-------------|
| [README.md](../README.md) | Project overview, quick-start (5 min setup) |
| [Setup Guide](guides/setup_guide.md) | Full dev environment walkthrough |
| [User Guide](guides/user_guide.md) | How to use the app as an end user |

---

## 🏗️ Architecture

| Document | Description |
|---------|-------------|
| [Project Architecture](architecture/project_architecture.md) | Client-side audio pipeline, ONNX + WebGPU, streaming inference diagram |
| [API Specification](architecture/api_specification.md) | All Next.js API routes + Python endpoint reference |
| [Web Workers Guide](architecture/web_workers_guide.md) | Audio worker design, message protocol |
| [ONNX/GPU Integration](architecture/onnx_gpu_integration.md) | ONNX Runtime Web + WebGPU configuration |
| [Backend DB Architecture](architecture/backend_db_architecture.md) | Python backend data flow + job persistence |
| [Song Library Implementation](architecture/song_library_implementation.md) | IndexedDB schema (Dexie.js), store design |
| [Web App Analysis](architecture/web_app_analysis.md) | Technical decisions and trade-offs |

---

## 🛠️ Developer Guides

| Document | Description |
|---------|-------------|
| [Developer Guide](guides/developer_guide.md) | Git workflow, code conventions, PR checklist, security rules |
| [Audio Processing Guide](guides/audio_processing_guide.md) | Web Audio API, AudioContext, stem mixing |
| [YouTube Integration](guides/youtube_integration.md) | yt-dlp download flow, URL validation |
| [IndexedDB Storage Guide](guides/indexeddb_storage_guide.md) | Using the Dexie.js storage layer |
| [Model Optimization Guide](guides/model_optimization_guide.md) | ONNX quantization, WASM threading |
| [Glossary & FAQ](guides/glossary_faq.md) | Terms and frequently asked questions |
| [MCP Setup Guide](guides/mcp_setup_guide.md) | AI coding assistant integration |
| [DevOps Setup Guide](guides/devops_setup_guide.md) | CI/CD configuration |

---

## 🧪 Testing

| Document | Description |
|---------|-------------|
| [Testing Guide](testing/TESTING_GUIDE.md) | All 5 stages: pytest → Jest → Playwright → Integration → CI |
| [Debugging Plan](testing/DEBUGGING_PLAN.md) | Agent debugging instructions, common failure patterns |
| [Roadmap](testing/ROADMAP.md) | Testing roadmap and coverage targets |

---

## 🚢 Deployment

| Document | Description |
|---------|-------------|
| [Deployment Overview](deployment/deployment.md) | Deployment architecture + current status |
| [Vercel Setup](deployment/vercel_setup.md) | Frontend deployment to Vercel |
| [Vercel CLI Guide](deployment/vercel_cli_guide.md) | CLI-based deployment workflow |
| [Quick Deploy](deployment/quick_deploy.md) | One-page deploy cheatsheet |
| [Status](deployment/status.md) | Current deployment status |

---

## 🔒 Security

| Document | Description |
|---------|-------------|
| [Security Audit Report](../plans/security-performance-audit-report.md) | 23 vulnerabilities catalogued, remediation progress tracker |
| [Security Refactoring Guide](../plans/security-refactoring-guide.md) | Refactoring guide implementing security fixes |

---

## 📐 Specifications & Plans

| Document | Status | Description |
|---------|--------|-------------|
| [Ghost Mode Spec](specifications/ghost_mode_spec.md) | 🔮 Future | Audio-reactive typography spec |
| [Roadmap Timeline](specifications/roadmap_timeline.md) | 📋 Plan | Feature roadmap with estimates |
| [Testing Optimization & Deployment](specifications/testing_optimization_deployment.md) | 📋 Plan | Test + deploy strategy |
| [Interface Audit & Optimization](../plans/interface_audit_optimization.md) | 📋 Plan | UI/UX optimization analysis |
| [Performance Optimization Plan](../plans/performance_optimization_plan.md) | 📋 Plan | Frontend + backend perf plan |
| [Optimization Robustness Architecture](../plans/optimization_robustness_architecture.md) | 📋 Plan | Resilience and error handling |
| [Real-time Effects Specification](../plans/audio-karaoke-realtime-effects-specification.md) | 🔮 Future | Real-time audio effects pipeline |
| [MP3 Download Fix Plan](../plans/mp3-download-fix-plan.md) | ✅ Addressed | Fix plan for MP3 download issues |

---

## 🐍 Python Backend

| Document | Description |
|---------|-------------|
| [Python CLI README](../python-audio-cli/README.md) | Backend server setup, API endpoints, CLI usage |

---

## 📊 Project Status

| Document | Description |
|---------|-------------|
| [Project Roadmap](../OVERALLROADBUILDING.MD) | What's built, current sprint, upcoming features |
| [Engineering TODO](../MUZIKA_ENGINEER_TODO.md) | All tasks by priority with complexity estimates |
