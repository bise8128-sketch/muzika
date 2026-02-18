import { test, expect, devices } from '@playwright/test';

/**
 * Responsive Design E2E Tests
 *
 * Tests the app at different viewport sizes to ensure proper responsive behavior.
 * Simulates real users on mobile, tablet, and desktop devices.
 */

const VIEWPORTS = {
    mobile: { width: 375, height: 667 },    // iPhone SE
    tablet: { width: 768, height: 1024 },    // iPad
    desktop: { width: 1440, height: 900 },   // MacBook Pro
};

test.describe('Responsive Design', () => {
    test.setTimeout(30000);

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('muzika_onboarding_completed', 'true');
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
                body: JSON.stringify({ models: [] }),
            });
        });
    });

    test('mobile layout (375×667)', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
        await page.goto('/');

        // Page should load without horizontal scroll
        const body = page.locator('body');
        await expect(body).toBeVisible();

        // Upload area should still be visible and usable
        const uploadText = page.getByText('Select Audio Files');
        await expect(uploadText).toBeVisible({ timeout: 10000 });

        // File input should be present
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();

        // Verify no horizontal overflow
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // Allow 5px tolerance
    });

    test('tablet layout (768×1024)', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.tablet);
        await page.goto('/');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        const uploadText = page.getByText('Select Audio Files');
        await expect(uploadText).toBeVisible({ timeout: 10000 });

        // No horizontal overflow
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });

    test('desktop layout (1440×900)', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await page.goto('/');

        const body = page.locator('body');
        await expect(body).toBeVisible();

        const uploadText = page.getByText('Select Audio Files');
        await expect(uploadText).toBeVisible({ timeout: 10000 });

        // Desktop should have full heading visible
        await expect(page.getByText('Separate your music')).toBeVisible();
    });

    test('viewport resize mid-session', async ({ page }) => {
        // Start on desktop
        await page.setViewportSize(VIEWPORTS.desktop);
        await page.goto('/');
        await expect(page.getByText('Select Audio Files')).toBeVisible({ timeout: 10000 });

        // Resize to mobile — should adapt without breaking
        await page.setViewportSize(VIEWPORTS.mobile);
        await page.waitForTimeout(500); // Allow re-render

        const isPageAlive = await page.locator('body').isVisible();
        expect(isPageAlive).toBe(true);

        // Resize back to desktop
        await page.setViewportSize(VIEWPORTS.desktop);
        await page.waitForTimeout(500);

        const stillAlive = await page.locator('body').isVisible();
        expect(stillAlive).toBe(true);
    });
});
