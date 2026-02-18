import { test, expect } from '@playwright/test';

/**
 * Full-Stack Integration Test
 *
 * Tests the complete pipeline WITHOUT mock APIs:
 * Next.js frontend → API routes → Python backend
 *
 * IMPORTANT: Requires both servers running via `npm run dev`.
 * Skip in CI unless INTEGRATION=true.
 */

// Only run when INTEGRATION env var is set
const skipInCI = !process.env.INTEGRATION;

test.describe('Full-Stack Integration', () => {
    test.setTimeout(300000); // 5 minutes for real separation

    // Skip all tests if not in integration mode
    test.skip(skipInCI, 'Skipping integration tests (set INTEGRATION=true to enable)');

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('muzika_onboarding_completed', 'true');
        });

        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`PAGE_ERROR: ${err}`));
    });

    test('real: backend health check', async ({ page }) => {
        await page.goto('/');

        // Verify the app loads and can communicate with the backend
        const response = await page.request.get('http://localhost:3030/api/status');
        expect(response.ok()).toBe(true);

        const data = await response.json();
        expect(data.status).toBe('ok');
        expect(data.services).toBeDefined();
    });

    test('real: Python backend health', async ({ page }) => {
        // Check Python backend directly
        const response = await page.request.get('http://localhost:8000/api/health');
        expect(response.ok()).toBe(true);

        const data = await response.json();
        expect(data.status).toBe('healthy');
        expect(data.device).toBeDefined();
    });

    test('real: upload and separate a short audio file', async ({ page }) => {
        await page.goto('/');

        // Upload a real audio file
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();

        // Use the test fixture (this should be a real, short audio file)
        await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');

        // Wait for processing to start
        // This uses the real Python backend — could take several minutes
        const processingOrResults = page.getByText(/Separating|Processing|Separation Complete/i);
        await expect(processingOrResults.first()).toBeVisible({ timeout: 30000 });

        // Wait for separation to complete
        const resultsHeading = page.getByRole('heading', { name: /Separation Complete/i });
        await expect(resultsHeading).toBeVisible({ timeout: 240000 }); // 4 minute timeout

        // Verify download buttons
        await expect(page.getByRole('button', { name: /WAV/i }).first()).toBeVisible();
    });

    test('real: library shows processed songs', async ({ page }) => {
        // Check the library endpoint shows songs
        const response = await page.request.get('http://localhost:3030/api/backend-library');
        expect(response.ok()).toBe(true);

        const data = await response.json();
        expect(data.songs).toBeDefined();
        expect(Array.isArray(data.songs)).toBe(true);
    });
});
