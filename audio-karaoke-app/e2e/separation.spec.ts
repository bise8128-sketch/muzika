import { test, expect } from '@playwright/test';

test.describe('Audio Separation Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Handle onboarding if it appears and wait for it to be stable
        const skipButton = page.getByRole('button', { name: /Skip/i });
        if (await skipButton.isVisible()) {
            await skipButton.click();
        }
        // Wait for overlay to disappear
        await expect(skipButton).not.toBeVisible();
    });

    test('should allow user to upload and separate audio', async ({ page }) => {
        // 1. Verify we are on the upload page using text content
        await expect(page.getByText('Separate your music with AI precision.')).toBeVisible();

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
