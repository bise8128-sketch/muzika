# Developer Guide

> **Last Updated**: February 2026  
> For new contributors and existing team members.

---

## Getting Started

1. Complete the **[setup_guide.md](setup_guide.md)** to get your environment running
2. Read this guide for workflow, conventions, and architecture expectations
3. Check **[../../MUZIKA_ENGINEER_TODO.md](../../MUZIKA_ENGINEER_TODO.md)** to pick up a task

---

## Git Workflow

### Branch naming

```
task/<CATEGORY>-<ID>-<short-description>

Examples:
  task/CF-04-abort-controller-cleanup
  task/AR-01-decompose-page-component
  task/FI-01-ai-lyric-sync
```

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add lyric sync via Whisper ONNX
fix: dispose ONNX tensors after inference
refactor: decompose KaraokePlayer into sub-components
docs: rewrite setup_guide in English
test: add Playwright spec for error recovery
chore: update onnxruntime-web to 1.18
```

### PR checklist

Before opening a PR:
- [ ] All lint checks pass: `cd audio-karaoke-app && npm run lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Unit tests pass: `npm test`
- [ ] E2E tests pass: `npx playwright test`
- [ ] PR title follows Conventional Commits format
- [ ] PR description links to the task in `MUZIKA_ENGINEER_TODO.md`

---

## Code Architecture

### Frontend layers

```
UI Layer         → src/components/  (React components, pure display)
Hook Layer       → src/hooks/       (state management, side effects)
Service Layer    → src/utils/       (audio, ml, storage — no React)
Worker Layer     → src/workers/     (off-main-thread heavy processing)
API Layer        → src/app/api/     (Next.js API routes — thin proxies)
```

**Rule**: Components should never import directly from `utils/ml/` or `utils/audio/`. They use hooks, which use utils.

### Adding a new feature

1. Define TypeScript types in `src/types/` if needed
2. Write the core logic in `src/utils/` (pure functions, no React)
3. Create a hook in `src/hooks/` that wraps the utility
4. Build the component in `src/components/` using the hook
5. Add unit tests for the utility and hook
6. Add a Playwright spec for the user-facing behavior

### Web Workers

All ML inference must stay in `src/workers/audio.worker.ts` — never run ONNX on the main thread.

Communication pattern:
```typescript
// Main thread → Worker
worker.postMessage({ type: 'SEPARATE', payload: { audioData } });

// Worker → Main thread
self.postMessage({ type: 'CHUNK_READY', payload: { vocals, instrumentals } });
```

---

## Code Style

### TypeScript

- **Strict mode is on** — no `any` unless absolutely necessary (comment why)
- Use explicit return types on public functions
- Use `interface` for public APIs, `type` for internal unions/intersections

### React

- Use functional components + hooks only (no class components)
- Use `React.memo()` for expensive pure components
- Prefer `useReducer` over multiple `useState` calls for complex state
- Clean up side effects in `useEffect` return functions

### CSS / Tailwind

- Use `@apply` directives in CSS files for repeated patterns
- Never use inline `style={}` unless for dynamic values (canvas size, etc.)
- Maintain dark mode support using `dark:` Tailwind variants

---

## Testing Conventions

### Unit tests (Jest)

Location: `src/**/__tests__/*.test.ts`

```typescript
describe('lrcParser', () => {
  it('parses a valid LRC file', () => {
    const result = parseLRC('[00:01.00]Hello world');
    expect(result[0]).toEqual({ startTime: 1, text: 'Hello world' });
  });
});
```

### E2E tests (Playwright)

Location: `e2e/*.spec.ts`

- Use `page.getByRole()` and `page.getByTestId()` — not CSS selectors
- Every interactive element needs a `data-testid` attribute
- Never use fixed `page.waitForTimeout()` — use `page.waitForSelector()` instead

---

## Security Rules

> These apply to every PR. The audit in `plans/security-performance-audit-report.md` defines the baseline.

1. **No `dangerouslySetInnerHTML`** — use DOMPurify if HTML rendering is required
2. **No wildcard CORS** — always use origin whitelisting
3. **Validate all inputs** at the API route level using Zod schemas
4. **Sanitize file paths** — reject segments containing `..`, `/`, or `\`
5. **No raw error messages** to clients — map internal errors to user-safe messages

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|---------|
| `NEXT_PUBLIC_PYTHON_SERVICE_URL` | URL of Python backend | Yes |
| `NEXT_PUBLIC_APP_URL` | Public app URL (for CORS) | Yes |

Never commit `.env.local`. Use `.env.local.example` as the template.

---

## Performance Rules

- Audio processing must happen in a **Web Worker** or the Python backend — never block the main thread
- Use **`Transferable` objects** (`Float32Array`) when posting data to workers
- Always call `tensor.dispose()` after ONNX inference
- Use `React.memo`, `useMemo`, `useCallback` for components that re-render on audio time updates

---

## Useful Commands

```bash
# Start development (both servers)
cd audio-karaoke-app && npm run dev

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Unit tests with coverage
npm test -- --coverage

# E2E tests (headed for debugging)
npx playwright test --headed

# Bundle analysis
ANALYZE=true npm run build
```
