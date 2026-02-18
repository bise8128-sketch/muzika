# 🧪 Muzika — Testing Instructions

> 5 stages from unit tests to production-ready. Follow them in order.

---

## Stage 1 — Python Backend Tests

**What:** Test all FastAPI endpoints, job lifecycle, and WebSocket rooms.

```bash
cd python-audio-cli
source venv/bin/activate          # activate virtual env
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
|-----------|---------------|
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

# Run only the new API route tests
npm test -- --testPathPattern="api/__tests__"

# Run with coverage report
npm test -- --coverage
```

**✅ Pass criteria:** 32+ new API tests + 32 existing tests = 60+ total, all green.

| Test File | What It Covers |
|-----------|---------------|
| `backend-upload.test.ts` | File upload proxy, no-file error, backend failure |
| `backend-download.test.ts` | Download proxy, circuit breaker, unreachable |
| `python-processing.test.ts` | Validation, separation, URL download flow |
| `backend-library.test.ts` | Library fetch, empty state, backend offline |
| `backend-files.test.ts` | Path traversal blocked, bad extensions, 404 |
| `extract-youtube.test.ts` | URL validation, timeout, restricted videos |

---

## Stage 3 — E2E Browser Tests (Playwright)

**What:** Simulate real human users clicking through the app in a real browser.

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

# Run a specific test
npx playwright test e2e/full-journey.spec.ts
npx playwright test e2e/accessibility.spec.ts
```

**✅ Pass criteria:** All specs pass on Chromium. No page crashes, no unhandled errors.

| Test File | What It Simulates |
|-----------|-------------------|
| `full-journey.spec.ts` | Upload → separation → results → karaoke player → settings |
| `error-recovery.spec.ts` | Upload fails, backend offline, separation timeout |
| `settings-and-preferences.spec.ts` | Open/close settings, keyboard navigation |
| `responsive-design.spec.ts` | Mobile (375px), tablet (768px), desktop (1440px), resize |
| `accessibility.spec.ts` | Headings, alt text, keyboard focus, button labels, contrast |

---

## Stage 4 — Full-Stack Integration

**What:** Test the real pipeline end-to-end — frontend talks to actual Python backend, no mocks.

```bash
# Terminal 1: Start both servers
cd audio-karaoke-app
npm run dev

# Terminal 2: Run integration tests
cd audio-karaoke-app
INTEGRATION=true npx playwright test e2e/integration.spec.ts --headed
```

**✅ Pass criteria:** Real upload + separation completes. Stems are downloadable. Library shows the song.

> ⚠️ This requires the Python backend with models installed. Separation of a 10s file takes ~1-3 minutes depending on your hardware.

---

## Stage 5 — CI Pipeline (Automated on Push)

**What:** Every push to `main`/`develop` and every PR automatically runs all tests.

```
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
                   │ Chromium    │
                   └─────────────┘
```

**How to trigger:** Just push code.

```bash
git add .
git commit -m "feat: comprehensive test suite"
git push origin main
```

**✅ Pass criteria:** All 4 jobs green ✅ in GitHub Actions. View results at:
`https://github.com/<your-org>/muzika/actions`

**Debugging failed CI runs:**
- Download the `playwright-report` artifact from the Actions tab
- Open `index.html` to see screenshots and traces of failed tests
- Download `jest-coverage` artifact to see coverage gaps

---

## Quick Reference

| Stage | Command | Time |
|-------|---------|------|
| 1. Backend | `pytest tests/ -v` | ~5s |
| 2. Jest | `npm test` | ~15s |
| 3. E2E | `npx playwright test --headed` | ~2min |
| 4. Integration | `INTEGRATION=true npx playwright test e2e/integration.spec.ts` | ~5min |
| 5. CI | `git push` | ~8min |
