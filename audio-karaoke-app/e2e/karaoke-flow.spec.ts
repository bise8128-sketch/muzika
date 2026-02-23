import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Karaoke Flow', () => {

    
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        await page.goto('/');
        
        // Wait for page to be ready (either onboarding or upload view)
        await page.waitForLoadState('networkidle');

        // Skip onboarding if present
        const skipButton = page.getByRole('button', { name: /Skip/i });
        try {
            if (await skipButton.isVisible({ timeout: 10000 })) {
                await skipButton.click();
                await expect(skipButton).not.toBeVisible({ timeout: 10000 });
            }
        } catch (e) {
            // Probably not visible, move on
        }
    });

    test('should enhance audio and show player', async ({ page }) => {
        // 1. Upload file
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        
        await fileInput.setInputFiles('e2e/fixtures/dummy.mp3');
        
        // 2. Wait for ProcessingView to appear
        // This is more robust than checking URL patterns during redirects
        await expect(page.getByTestId('processing-view')).toBeVisible({ timeout: 60000 });

        // 3. Wait for processing progress
        await expect(page.getByText(/Separating Audio/i)).toBeVisible({ timeout: 20000 });

        // 4. Wait for player/results to appear
        // Use a longer timeout as this involves sequential Separation + Transcription (Whisper)
        await expect(page).toHaveURL(/\/(results|karaoke)\//, { timeout: 300000 });

        // 5. Wait for player container
        const playerContainer = page.locator('.glass-premium'); 
        await expect(playerContainer).toBeVisible({ timeout: 30000 });
        
        // 6. Check controls
        await expect(page.getByText('Original')).toBeVisible(); 
        
        // 5. Test basic interaction
        // Play
        // await page.keyboard.press('Space'); // Toggle play
        // Expect time updates? Requires audio context to be running, might be flaky in CI without user interaction policy flag
        
        // Just verifying the player mounted is a good enough smoke test for now
    });
});
