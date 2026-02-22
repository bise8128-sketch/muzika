# 🧪 Muzika — Testing Guide

> **Last Updated**: February 2026  
> Run these stages in order for a full quality check.

---

## Overview

| Stage | Tool | Command | Time |
| :--- | :--- | :--- | :--- |
| 1. Python Backend | pytest | `pytest tests/ -v` | ~5s |
| 2. Frontend Unit | Jest | `npm test` | ~15s |
| 3. E2E Browser | Playwright | `npx playwright test` | ~2min |
| 4. Full Integration | Playwright + real backend | `INTEGRATION=true npx playwright test e2e/integration.spec.ts` | ~5min |
| 5. CI Pipeline | GitHub Actions | `git push` | ~8min |

---

## Stage 1 — Python Backend Tests

**What:** Test all FastAPI endpoints, job lifecycle, and WebSocket rooms.

```bash
cd python-audio-cli
source venv/bin/activate           # activate virtual env
pip install pytest pytest-asyncio  # install test deps (first time only)

# Run all backend tests
pytest tests/ -v

# Run a specific file
pytest tests/test_endpoints.py -v
pytest tests/test_job_lifecycle.py -v
pytest tests/test_websocket.py -v
```

**✅ Pass criteria:** All 36 tests green. No import errors, no crashes.

| Test File | What It Covers |
| :--- | :--- |
| `test_endpoints.py` | Health, models, upload, download, separation, jobs, library, file serving |
| `test_job_lifecycle.py` | Job states: pending → processing → completed/failed, Redis fallback |
| `test_websocket.py` | Room connect, broadcast, multi-user, disconnect, cleanup |

---

## Stage 2 — Next.js Unit Tests (Jest)

**What:** Test all API routes, components, hooks, and utilities.

```bash
cd audio-karaoke-app

# Run all unit tests
npm test

# Run only the API route tests
npm test -- --testPathPattern="api/__tests__"

# Run with coverage report
npm test -- --coverage
```

**✅ Pass criteria:** 60+ tests all green. Coverage report generated in `coverage/`.

| Test File | What It Covers |
| :--- | :--- |
| `backend-upload.test.ts` | File upload proxy, no-file error, backend failure |
| `backend-download.test.ts` | Download proxy, circuit breaker, unreachable |
| `python-processing.test.ts` | Validation, separation, URL download flow |
| `backend-library.test.ts` | Library fetch, empty state, backend offline |
| `backend-files.test.ts` | Path traversal blocked, bad extensions, 404 |
| `extract-youtube.test.ts` | URL validation, timeout, restricted videos |

---

## Stage 3 — E2E Browser Tests (Playwright)

**What:** Simulate real users clicking through the app in a real browser.

```bash
cd audio-karaoke-app

# Install browsers (first time only)
npx playwright install

# Run all E2E tests (auto-starts dev server)
npx playwright test

# Run in headed mode (watch the browser)
npx playwright test --headed

# Run interactive UI mode (best for debugging)
npx playwright test --ui

# Run a specific spec
npx playwright test e2e/full-journey.spec.ts
npx playwright test e2e/accessibility.spec.ts
```

**✅ Pass criteria:** All specs pass on Chromium. No page crashes, no unhandled errors.

| Spec File | What It Simulates |
| :--- | :--- |
| `full-journey.spec.ts` | Upload → separation → results → karaoke player → settings |
| `error-recovery.spec.ts` | Upload fails, backend offline, separation timeout |
| `settings-and-preferences.spec.ts` | Open/close settings, keyboard navigation |
| `responsive-design.spec.ts` | Mobile (375px), tablet (768px), desktop (1440px), resize |
| `accessibility.spec.ts` | Headings, alt text, keyboard focus, button labels, contrast |

---

## Stage 4 — Full-Stack Integration

**What:** Test the real pipeline end-to-end — frontend talks to the actual Python backend, no mocks.

```bash
# Terminal 1: Start both servers
cd audio-karaoke-app
npm run dev

# Terminal 2: Run integration tests
cd audio-karaoke-app
INTEGRATION=true npx playwright test e2e/integration.spec.ts --headed
```

**✅ Pass criteria:** Real upload + separation completes. Stems are downloadable. Library shows the song.

> ⚠️ This requires the Python backend with Demucs models installed. Separation of a 10s clip takes ~1–3 minutes depending on hardware.

---

## Stage 5 — CI Pipeline (Automated on Push)

**What:** Every push to `main`/`develop` and every PR automatically runs all tests.

```text
Push/PR → GitHub Actions triggers:

  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ docs-links  │  │  frontend   │  │  backend    │
  │ (link check)│  │ lint+jest+  │  │ pytest      │
  │             │  │ build       │  │ 36 tests    │
  └─────────────┘  └──────┬──────┘  └─────────────┘
                          │
                   ┌──────▼──────┐
                   │    e2e      │
                   │ Playwright  │
                   └─────────────┘
```

**Trigger:** Just push code.

```bash
git add .
git commit -m "feat: your change"
git push origin main
```

**✅ Pass criteria:** All 4 jobs green ✅ in GitHub Actions.

**Debugging failed CI runs:**
- Download the `playwright-report` artifact from the Actions tab
- Open `index.html` to see screenshots and traces of failed tests
- Download `jest-coverage` artifact to check coverage gaps

---

## Debugging

Comprehensive debugging instructions can be found in **[DEBUGGING_STRATEGY.md](./DEBUGGING_STRATEGY.md)**.

### Playwright failures

```bash
# Run with full trace for post-mortem debugging
npx playwright test --trace on

# View trace
npx playwright show-trace test-results/trace.zip
```

### Jest failures

```bash
# Run with verbose output
npm test -- --verbose

# Run a single test file
npm test -- src/utils/__tests__/lrcParser.test.ts
```

### pytest failures

```bash
# Run with output capture disabled (see print statements)
pytest tests/ -v -s

# Run only failing tests
pytest tests/ --lf
```
