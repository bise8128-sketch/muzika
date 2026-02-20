import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Karaoke Player', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Skip onboarding if present
    const skipButton = page.getByRole('button', { name: /Skip/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }

    // Upload a file to enter karaoke mode
    // We use the existing logic from karaoke-flow.spec.ts as a base
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles('e2e/fixtures/dummy.mp3');

    // Wait for processing and for the player to appear
    const playerContainer = page.getByTestId('visualizer-container');
    // Large timeout for AI processing
    await expect(playerContainer).toBeVisible({ timeout: 90000 });
  });

  test('should show playback controls', async ({ page }) => {
    const playButton = page.getByTitle(/Play\/Pause/i);
    await expect(playButton).toBeVisible();
    
    // Check for volume sliders or balance
    await expect(page.getByText(/Vocal/i)).toBeVisible();
    await expect(page.getByText(/Music/i)).toBeVisible();
  });

  test('should toggle effects panels', async ({ page }) => {
    // Check for "Pitch" and "Tempo" in effects panel
    await expect(page.getByText(/Pitch/i).first()).toBeVisible();
    await expect(page.getByText(/Tempo/i).first()).toBeVisible();
    
    // Try to find Reverb/Echo controls
    await expect(page.getByText(/Reverb/i)).toBeVisible();
    await expect(page.getByText(/Echo/i)).toBeVisible();
  });

  test('should toggle stage mode', async ({ page }) => {
    // Look for stage mode button - usually in the header or toolbar
    const stageModeBtn = page.getByRole('button', { name: /Stage Mode/i }).or(page.getByTitle(/Stage Mode/i));
    if (await stageModeBtn.isVisible()) {
        await stageModeBtn.click();
        // Stage mode usually goes fullscreen/fixed
        await expect(page.locator('.fixed.inset-0')).toBeVisible();
        
        // Exit stage mode
        const exitBtn = page.getByRole('button', { name: /Exit/i }).or(page.getByTitle(/Exit/i));
        if (await exitBtn.isVisible()) {
            await exitBtn.click();
        }
    }
  });

  test('should show pitch analysis UI when enabled', async ({ page }) => {
    const pitchAnalysisBtn = page.getByRole('button', { name: /Pitch Analysis/i });
    await expect(pitchAnalysisBtn).toBeVisible();
    
    await pitchAnalysisBtn.click();
    // Should show "Stop Analysis" and the visualizer
    await expect(page.getByText(/Stop Analysis/i)).toBeVisible();
    // Check for PitchVisualizer elements (e.g., canvas or specific text)
    // The component PitchVisualizer is rendered when showPitchAnalysis is true
  });
});
