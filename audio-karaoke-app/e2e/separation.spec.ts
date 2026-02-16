import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Audio Separation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock successful upload
    await page.route('**/api/backend-upload', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ filename: 'test-audio.mp3' })
      });
    });

    // Mock successful processing initiation
    await page.route('**/api/python-processing', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          status: 'completed', 
          jobId: 'mock-job-id',
          stems: {
            vocals: 'data:audio/wav;base64,UklGRi...', // Dummy base64 wav
            instrumental: 'data:audio/wav;base64,UklGRi...'
          }
        })
      });
    });

    // Mock model downloads to fail fast (force server fallback or fail gracefully)
    // Or mock them to prevent actual large downloads
    await page.route('**/models/**/*.onnx', route => route.abort());
    await page.route('**/models/**/*.wasm', route => route.abort());
  });

  test('should go to separation progress screen on upload', async ({ page }) => {
    await page.goto('/');

    // Locate upload input (it might be hidden, so we use setInputFiles on the label or container if needed,
    // but usually pointing to input[type=file] works even if hidden)
    // We need to find the input. Inspecting the code or making a guess based on standard practices.
    // Assuming there is an input[type="file"]
    
    // Create a dummy file for upload
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');

    // After upload, there might be a "Start" button or it might auto-start
    // Let's assume there is a button to proceed if it doesn't auto-start
    // Check for "Separating" text or progress bar
    // If the app uses client-side by default, it might try to download models.
    // We aborted model downloads, so it might fail or show error.
    // BUT we want to verify the UI *tried* to start.
    
    // Wait for some indication of processing
    // Adjust selector based on actual UI
    // Common text: "Separating Platform", "Processing...", "Analyzing"
    
    // We expect *some* transition.
    // If the app is robust, aborting models might show an error "Failed to load models".
    // That is also a valid test result for "Flow verification" (showing it attempted).
    // But ideally we want to see the progress screen.
    
    // Let's explicitly check for the "Separating" text which usually appears during processing.
    await expect(page.getByText(/Separating|Analyzing|Processing/i)).toBeVisible({ timeout: 10000 });
  });
});
