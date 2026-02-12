---
name: testing
description: Run and manage tests for the Muzika karaoke application. Use when user asks to run tests, check test coverage, debug test failures, or add new tests.
metadata:
  category: development
  source:
    repository: https://github.com/kilo-code/skills
    path: testing
---

# Testing

Run and manage tests for the Muzika karaoke application.

## Test Stack

- **Unit Tests**: Jest with React Testing Library
- **E2E Tests**: Playwright
- **Coverage**: Istanbul/V8 coverage

## Quick Start

### Run All Tests

```bash
cd audio-karaoke-app
npm test
```

### Run Unit Tests

```bash
npm test -- --testPathPattern="src/utils"
```

### Run E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npm test -- --testPathPattern="audioDecoder.test.ts"
```

### Watch Mode

```bash
npm test -- --watch
```

## Test Structure

```
audio-karaoke-app/
├── src/
│   ├── components/**/__tests__/   # Component tests
│   ├── hooks/__tests__/           # Hook tests
│   └── utils/**/__tests__/        # Utility tests
├── e2e/                           # E2E tests
└── playwright.config.ts           # Playwright config
```

## Writing Tests

### Component Tests

```tsx
// src/components/UI/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toHaveTextContent('Click me');
});
```

### Hook Tests

```tsx
// src/hooks/__tests__/usePlayback.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '../usePlayback';

test('playback controls work', () => {
  const { result } = renderHook(() => usePlayback());
  
  act(() => {
    result.current.play();
  });
  
  expect(result.current.isPlaying).toBe(true);
});
```

### Utility Tests

```tsx
// src/utils/audio/__tests__/pitchAnalysis.test.ts
import { pitchAnalysis } from '../pitchAnalysis';

test('analyzes pitch correctly', async () => {
  const audioBuffer = createMockAudioBuffer();
  const result = await pitchAnalysis(audioBuffer);
  
  expect(result.frequencies).toBeDefined();
});
```

### E2E Tests

```typescript
// e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('h1')).toContainText('Muzika');
});
```

## Coverage

### Generate Coverage Report

```bash
npm test -- --coverage
```

### View Coverage

Open `coverage/lcov-report/index.html` in a browser.

### Coverage Goals

- Aim for 80%+ overall coverage
- Focus on utility functions and hooks
- Critical paths should have 90%+ coverage

## Running Specific Test Suites

| Command | Description |
|---------|-------------|
| `npm test -- --testPathPattern="audio"` | Audio-related tests |
| `npm test -- --testPathPattern="hooks"` | Hook tests |
| `npm test -- --testPathPattern="components"` | Component tests |
| `npm run test:e2e -- --grep="separation"` | E2E separation tests |

## Debugging Failed Tests

### View Detailed Output

```bash
npm test -- --verbose
```

### Run Single Test

```bash
npm test -- --testNamePattern="specific test name"
```

### Debug with Node Inspector

```bash
npm test -- --inspect-brk
```

Then open `chrome://inspect` in Chrome.

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch

### Manual CI Run

```bash
npm run test:ci
```

## Troubleshooting

### Tests Failing

1. Check test output for assertion failures
2. Verify mock implementations
3. Check for console errors
4. Clear Jest cache: `npm test -- --clearCache`

### E2E Tests Timeout

- Check if dev server is running
- Increase timeout in `playwright.config.ts`
- Check network requests with `npm run test:e2b -- --debug`

### Flaky Tests

- Add retries: `npm test -- --retries=3`
- Check for race conditions
- Increase wait times for async operations
