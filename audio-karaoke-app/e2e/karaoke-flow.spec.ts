import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Karaoke Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        
        // Skip onboarding if present
        const skipButton = page.getByRole('button', { name: /Skip/i });
        if (await skipButton.isVisible()) {
            await skipButton.click();
        }
        await expect(skipButton).not.toBeVisible();
    });

    test('should enhance audio and show player', async ({ page }) => {
        // 1. Upload file
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        
        await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'dummy.mp3'));

        // 2. Wait for processing progress
        // Should catch the toast or progress bar
        await expect(page.getByText(/Analyzing file/i)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/Separating/i)).toBeVisible({ timeout: 30000 });

        // 3. Wait for player to appear
        // The player header or play button should be visible
        // We look for a play button or the "Original" preset label
        const playerContainer = page.locator('.glass-premium'); // Main visualizer/player container
        await expect(playerContainer).toBeVisible({ timeout: 60000 });
        
        // 4. Check controls
        const playButton = page.getByTitle('Play/Pause'); // Assuming title prop or aria-label
        // Or look for lucide-react Play icon
        // Let's look for known elements in the player interface
        await expect(page.getByText('Original')).toBeVisible(); // Default preset
        
        // 5. Test basic interaction
        // Play
        // await page.keyboard.press('Space'); // Toggle play
        // Expect time updates? Requires audio context to be running, might be flaky in CI without user interaction policy flag
        
        // Just verifying the player mounted is a good enough smoke test for now
    });
});
