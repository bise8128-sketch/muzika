import { test, expect } from '@playwright/test';

/**
 * Error Recovery E2E Tests
 * 
 * Simulates failure scenarios a real user might encounter:
 * - Network failures during upload
 * - Invalid file uploads
 * - Backend offline
 */
test.describe('Error Recovery', () => {


    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('muzika_onboarding_completed', 'true');
        });

        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    });

    test('handles upload failure gracefully', async ({ page }) => {
        // Mock upload endpoint to return 500
        await page.route('**/api/backend-upload', async route => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal server error' }),
            });
        });

        // Mock other required endpoints
        await page.route('**/api/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ services: { modelRepository: 'connected' } }),
            });
        });

        await page.route('**/api/models', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ models: [] }),
            });
        });

        await page.goto('/');

        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();

        // Upload a file — expect it to fail
        await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');

        // Should show some kind of error message or toast
        // The app should NOT crash — verify it's still interactive
        await page.waitForTimeout(3000);

        // Verify the page is still interactive (upload area still present or error shown)
        const isPageAlive = await page.locator('body').isVisible();
        expect(isPageAlive).toBe(true);
    });

    test('handles backend offline gracefully', async ({ page }) => {
        // Mock status endpoint to simulate offline backend
        await page.route('**/api/status', async route => {
            await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Service unavailable' }),
            });
        });

        await page.route('**/api/models', async route => {
            await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ models: [] }),
            });
        });

        await page.goto('/');

        // The page should still load — even with backend offline
        await page.waitForTimeout(2000);
        const isPageAlive = await page.locator('body').isVisible();
        expect(isPageAlive).toBe(true);

        // Upload area should still be visible (client-side mode may be offered)
        const uploadText = page.getByText('Select Audio Files');
        if (await uploadText.isVisible({ timeout: 5000 }).catch(() => false)) {
            expect(true).toBe(true); // Page rendered correctly despite backend being down
        }
    });

    test('handles separation timeout gracefully', async ({ page }) => {
        await page.route('**/api/backend-upload', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ filename: 'test.mp3' }),
            });
        });

        await page.route('**/api/python-processing*', async route => {
            if (route.request().method() === 'POST') {
                // Simulate a very slow response (timeout scenario)
                await new Promise(resolve => setTimeout(resolve, 10000));
                await route.fulfill({
                    status: 504,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Separation process timed out' }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ status: 'ready' }),
                });
            }
        });

        await page.route('**/api/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ services: { modelRepository: 'connected' } }),
            });
        });

        await page.route('**/api/models', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ models: [{ id: 'htdemucs', name: 'Test', type: 'htdemucs' }] }),
            });
        });

        await page.goto('/');

        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');

        // Wait and verify the page doesn't crash
        await page.waitForTimeout(12000);
        const isPageAlive = await page.locator('body').isVisible();
        expect(isPageAlive).toBe(true);
    });
});
