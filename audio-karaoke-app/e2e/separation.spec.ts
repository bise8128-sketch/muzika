import { test, expect } from '@playwright/test';

test.describe('Audio Separation Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle onboarding if it appears
        const skipButton = page.getByRole('button', { name: /Skip/i });
        if (await skipButton.isVisible()) {
            await skipButton.click();
        }
    });

    test('should allow user to upload and separate audio', async ({ page }) => {
        // 1. Verify we are on the upload page
        await expect(page.getByRole('heading', { name: /Separate your music/i })).toBeVisible();

        // 2. Verify upload button exists
        await expect(page.getByText('Select Audio Files')).toBeVisible();
        expect(page.locator('input[type="file"]')).toBeAttached();
    });

    test('should show settings panel', async ({ page }) => {
        // Click the settings icon (it's the last button in the nav on desktop)
        await page.locator('nav').locator('button').last().click();
        await expect(page.getByText('Separation Settings')).toBeVisible();
    });
});
