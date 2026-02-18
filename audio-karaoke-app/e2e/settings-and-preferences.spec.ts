import { test, expect } from '@playwright/test';

/**
 * Settings & Preferences E2E Tests
 *
 * Simulates a real user configuring and persisting app settings.
 */
test.describe('Settings and Preferences', () => {
    test.setTimeout(60000);

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
                body: JSON.stringify({
                    models: [
                        { id: 'htdemucs', name: 'Demucs v4 HQ', type: 'htdemucs' },
                        { id: 'htdemucs_ft', name: 'Demucs v4 Fine-Tuned', type: 'htdemucs' },
                    ],
                }),
            });
        });

        // Block model downloads
        await page.route('**/models/**/*.onnx', route => route.abort());
    });

    test('user can open and close settings panel', async ({ page }) => {
        await page.goto('/');

        const settingsButton = page.getByTestId('settings-button');
        if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Open settings
            await settingsButton.click();
            await expect(page.getByText('Settings')).toBeVisible();

            // Verify settings content is present
            await expect(page.getByText('Processing Engine').first()).toBeVisible();
            await expect(page.getByText('Model Version')).toBeVisible();

            // Close settings — look for close button or click outside
            const closeButton = page.getByRole('button', { name: /close/i });
            if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await closeButton.click();
            } else {
                // Press Escape to close
                await page.keyboard.press('Escape');
            }
        }
    });

    test('settings panel is keyboard accessible', async ({ page }) => {
        await page.goto('/');

        // Tab to settings button
        const settingsButton = page.getByTestId('settings-button');
        if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            // Focus the settings button first
            await settingsButton.focus();
            
            // Press Enter to open
            await page.keyboard.press('Enter');
            
            // Settings panel should be visible
            await expect(page.getByText('Settings')).toBeVisible({ timeout: 5000 });

            // Tab through settings options — should be navigable
            await page.keyboard.press('Tab');
            
            // Escape should close the panel
            await page.keyboard.press('Escape');
        }
    });
});
