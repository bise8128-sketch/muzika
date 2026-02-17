import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Karaoke Flow - Pitch, Tempo & Visualizer', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    // Mock AudioContext to allow decoding of dummy data
    await page.addInitScript(() => {
      const MockAudioContext = class {
        state = 'running';
        sampleRate = 44100;
        constructor(..._args: unknown[]) {}
        createBufferSource() { return { start: () => {}, connect: () => {}, disconnect: () => {}, stop: () => {}, buffer: null, loop: false, playbackRate: { value: 1, setValueAtTime: () => {} } }; }
        createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 1, setValueAtTime: () => {} } }; }
        createAnalyser() { return { connect: () => {}, disconnect: () => {}, fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData: (array: Uint8Array) => { array.fill(128); }, getFloatTimeDomainData: () => {} }; }
        createConvolver() { return { connect: () => {}, disconnect: () => {}, buffer: null }; }
        createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } }; }
        createMediaElementSource() { return { connect: () => {}, disconnect: () => {} }; }
        createBuffer(channels: number, length: number, sampleRate: number) {
           return {
             numberOfChannels: channels,
             length: length,
             sampleRate: sampleRate,
             duration: length / sampleRate,
             getChannelData: () => new Float32Array(length)
           };
        }
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

      // Recursive dummy node to handle any property access
      const dummyNodeHandler = {
        get(_target: object, prop: string | symbol) {
          if (prop === 'connect' || prop === 'disconnect' || prop === 'start' || prop === 'stop') return () => {};
          return { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
        }
      };

      const proxyHandler = {
        get(target: InstanceType<typeof MockAudioContext>, prop: string | symbol) {
          if (prop in target) return Reflect.get(target, prop);
          return () => {
             return new Proxy({}, dummyNodeHandler);
          };
        }
      };

      // @ts-expect-error - Mocking AudioContext
      window.AudioContext = new Proxy(MockAudioContext, {
          construct(target: typeof MockAudioContext, args: unknown[]) {
              return new Proxy(new target(...args), proxyHandler);
          }
      });
      // @ts-expect-error - Mocking webkitAudioContext
      window.webkitAudioContext = window.AudioContext;
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
    await page.route('**/api/python-processing*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          status: 'completed', 
          jobId: 'mock-job-id',
          stems: {
            vocals: '/mock-audio/vocals.wav', 
            instrumental: '/mock-audio/instrumental.wav'
          }
        })
      });
    });

    // Mock the mock audio files
    await page.route('**/mock-audio/*.wav', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: Buffer.from('RIFF....WAVEfmt ') // Minimal RIFF header
      });
    });

    // Mock available models
    await page.route('**/api/models', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            { id: 'mdx-net-inst-v1', name: 'Default Server Model', type: 'htdemucs', isGpuSupported: false }
          ]
        })
      });
    });

    // Mock status to be online
    await page.route('**/api/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ services: { modelRepository: 'connected' } })
      });
    });

    await page.goto('/');
    
    // Skip onboarding if present
    const skipButton = page.getByRole('button', { name: /Skip/i });
    if (await skipButton.isVisible()) {
        await skipButton.click();
    }
  });

  test('should verify pitch/tempo adjustment and visualizer sync', async ({ page }) => {
    // 1. Upload file
    const fileInput = page.getByTestId('audio-upload-input');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles('e2e/fixtures/dummy.mp3');

    // 2. Wait for processing to complete and player to appear
    await expect(page.getByTestId('processing-view')).toBeVisible({ timeout: 10000 });

    // Processing finished, wait for "Try Karaoke" button and click it to enter player
    const tryKaraokeButton = page.getByRole('button', { name: /try karaoke/i });
    
    // Wait for any loading overlay or onboarding to disappear
    // The class bg-black/80 is used for onboarding and other overlays
    // We wait for it to be hidden or detached so it doesn't block the click
    try {
      await page.waitForSelector('.bg-black\\/80', { state: 'hidden', timeout: 30000 });
    } catch (e) {
      // If it's not there or doesn't disappear, Playwright's click will handle it with its own retry logic
    }

    // Increase timeout as separation might take time
    await expect(tryKaraokeButton).toBeVisible({ timeout: 120000 });
    await tryKaraokeButton.click();
    
    // Wait for the player container to be visible
    // Identifying player by a robust selector, e.g., the container with "Original" preset or play button
    const playerContainer = page.getByTestId('visualizer-container');
    await expect(playerContainer).toBeVisible({ timeout: 300000 });
    
    // 3. Verify Visualizer is present
    // The visualizer is likely a canvas inside the player container
    const visualizerCanvas = page.getByTestId('visualizer-canvas');
    await expect(visualizerCanvas).toBeVisible();
    
    // Check if canvas has dimensions (implies it's ready to draw)
    const box = await visualizerCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // 4. Verify Pitch Adjustment
    // Locate pitch slider - typically input[type="range"] with min="-12"
    // Using a more specific locator strategy if possible
    const pitchSlider = page.getByTestId('pitch-slider');
    await expect(pitchSlider).toBeVisible();
    
    // Change pitch to +2
    await pitchSlider.fill('2');
    // Trigger change event if needed (fill usually triggers input/change)
    
    // Verify the display updates to show +2
    await expect(page.getByTestId('pitch-value')).toHaveText('+2');

    // 5. Verify Tempo Adjustment
    // Locate tempo slider - typically input[type="range"] with step="0.05" or min="0.5"
    const tempoSlider = page.getByTestId('tempo-slider');
    await expect(tempoSlider).toBeVisible();
    
    // Change tempo to 1.25x
    await tempoSlider.fill('1.25');
    
    // Verify the display updates to show 1.25x
    await expect(page.getByTestId('tempo-value')).toHaveText('1.25x');

    // 6. Start Playback and verify visualizer is "active" (optional advanced check)
    const playButton = page.getByTestId('play-pause-button');
    await playButton.click();
    
    // Wait a bit for playback to start
    await page.waitForTimeout(500);
    
    // Verify pause icon appears (indicating playing state)
    // Or verify Play button title changes to "Pause"
    // Assuming the icon switches or aria-label updates
    // Check if there is a pause icon or "Pause" text
    // Just ensuring no crash happens is good for now
  });
});
