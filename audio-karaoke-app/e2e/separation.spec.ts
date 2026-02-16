import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Audio Separation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AudioContext to allow decoding of dummy data
    await page.addInitScript(() => {
      const MockAudioContext = class {
        state = 'running';
        sampleRate = 44100;
        createBufferSource() { return { start: () => {}, connect: () => {}, disconnect: () => {}, stop: () => {} }; }
        createGain() { return { connect: () => {}, gain: { value: 1 } }; }
        createAnalyser() { return { connect: () => {}, fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData: () => {}, getFloatTimeDomainData: () => {} }; }
        destination = {};
        decodeAudioData() {
          return Promise.resolve({
            length: 44100 * 5,
            numberOfChannels: 2,
            sampleRate: 44100,
            duration: 5,
            getChannelData: () => new Float32Array(44100 * 5)
          });
        }
      };
      // @ts-ignore
      window.AudioContext = MockAudioContext;
      // @ts-ignore
      window.webkitAudioContext = MockAudioContext;
    });

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

    // Mock available models
    await page.route('**/api/models', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { id: 'mdx-net-inst-v1', name: 'Default Model', type: 'mdx' },
            { id: 'htdemucs-v4', name: 'Server Model (HT Demucs)', type: 'htdemucs' }
          ]
        })
      });
    });

    // Mock model downloads to fail fast
    await page.route('**/models/**/*.onnx', route => route.abort());
    await page.route('**/models/**/*.wasm', route => route.abort());
  });

  test('should go to separation progress screen on upload', async ({ page }) => {
    await page.goto('/');

    // Wait for the model selector to be visible and stable
    const modelSelect = page.locator('#model-select');
    await expect(modelSelect).toBeVisible({ timeout: 10000 });

    // Select the server-side model
    await modelSelect.selectOption('htdemucs-v4');

    // Create a dummy file for upload
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');
    
    // We expect the app to transition to processing or results.
    // Since our mock returns 'completed' immediately, it might jump to results.
    // We check for either the processing message OR a results indicator.
    
    // Use a race condition check or just wait for one that implies success.
    // "Separating Audio..." is a heading in ProcessingView.
    // "Download" is in ResultsView.
    
    // We'll wait for the "Download" button which confirms the full flow.
    await expect(page.getByRole('button', { name: /Download/i }).first()).toBeVisible({ timeout: 20000 });
  });
});
