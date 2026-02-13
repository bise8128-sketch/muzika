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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (navigator as any).gpu;
            console.log('INIT SCRIPT: Simulated WebGPU absence (navigator.gpu deleted)');
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
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        
        // Use an absolute path or relative to project root
        const fixturePath = path.resolve('e2e/fixtures/dummy.mp3');
        await fileInput.setInputFiles(fixturePath);

        // 2. Verify ProcessingView is visible
        const processingHeader = page.getByText(/Separating Audio/i);
        await expect(processingHeader).toBeVisible({ timeout: 20000 });

        // 3. Verify Backend Indicator shows WASM
        const backendIndicator = page.getByText(/WASM \(CPU\)/i);
        await expect(backendIndicator).toBeVisible({ timeout: 15000 });
        
        console.log('SUCCESS: "WASM (CPU)" indicator found in ProcessingView');

        // 4. Wait for processing to complete (player to appear)
        const playerContainer = page.locator('.glass-premium');
        await expect(playerContainer).toBeVisible({ timeout: 90000 });
        
        console.log('SUCCESS: Processing completed successfully on WASM');
    });
});
