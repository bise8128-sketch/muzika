import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('WebGPU Fallback Verification', () => {
    test.setTimeout(120000); // Higher timeout for processing

    test.beforeEach(async ({ page }) => {
        // Logs for debugging
        page.on('console', msg => {
            if (msg.text().includes('[WebGPU]') || msg.text().includes('[onnxSetup]') || msg.text().includes('[separateAudio]')) {
                console.log(`BROWSER LOG: ${msg.text()}`);
            }
        });

        // Simulating absence of WebGPU by deleting navigator.gpu
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'gpu', {
                get: () => undefined,
                configurable: true
            });
            console.log('INIT SCRIPT: Simulated WebGPU absence (navigator.gpu undefined)');
        });

        await page.goto('/');
        
        // Skip onboarding if present
        const skipButton = page.getByRole('button', { name: /Skip/i });
        if (await skipButton.isVisible()) {
            await skipButton.click();
            await expect(skipButton).not.toBeVisible({ timeout: 10000 });
        }
    });

    test('should fallback to WASM when WebGPU is not available', async ({ page }) => {
        // 1. Upload file
        const fileInput = page.getByTestId('audio-upload-input');
        await expect(fileInput).toBeAttached();
        
        // Use an absolute path or relative to project root
        const fixturePath = path.resolve('e2e/fixtures/dummy.mp3');
        await fileInput.setInputFiles(fixturePath);

        // 2. Verify ProcessingView is visible
        const processingView = page.getByTestId('processing-view');
        await expect(processingView).toBeVisible({ timeout: 20000 });

        // 3. Verify Backend Indicator shows WASM
        const backendIndicator = page.getByTestId('backend-indicator');
        await expect(backendIndicator).toContainText(/WASM \(CPU\)/i);
        await expect(backendIndicator).toBeVisible({ timeout: 15000 });
        
        console.log('SUCCESS: "WASM (CPU)" indicator found in ProcessingView');

        // 4. Wait for processing to complete (player to appear)
        // Processing finished, wait for "Try Karaoke" button and click it to enter player
        const tryKaraokeButton = page.getByRole('button', { name: /try karaoke/i });
        // Increase timeout as separation might take time
        await expect(tryKaraokeButton).toBeVisible({ timeout: 90000 });
        await tryKaraokeButton.click();

        const playerContainer = page.getByTestId('visualizer-container');
        await expect(playerContainer).toBeVisible({ timeout: 30000 });
        
        console.log('SUCCESS: Processing completed successfully on WASM');
    });
});
