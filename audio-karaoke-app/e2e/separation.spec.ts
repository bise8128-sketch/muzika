import { test, expect } from '@playwright/test';

test.describe('Audio Separation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock AudioContext to allow decoding of dummy data
    await page.addInitScript(() => {
      const MockAudioContext = class {
        state = 'running';
        sampleRate = 44100;
        createBufferSource() { return { start: () => {}, connect: () => {}, disconnect: () => {}, stop: () => {}, buffer: null, loop: false }; }
        createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 1, setValueAtTime: () => {} } }; }
        createAnalyser() { return { connect: () => {}, disconnect: () => {}, fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData: () => {}, getFloatTimeDomainData: () => {} }; }
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

      // Recursive dummy node to handle any property access (e.g., delayTime.value)
      const dummyNodeHandler = {
        get(_target, prop) {
          if (prop === 'connect' || prop === 'disconnect' || prop === 'start' || prop === 'stop') return () => {};
          // Default all other properties to be AudioParams
          return { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
        }
      };

      const proxyHandler = {
        get(target, prop) {
          if (prop in target) return target[prop];
          console.log(`[MockAudioContext] Accessed missing property: ${String(prop)}`);
          return () => {
             console.log(`[MockAudioContext] Called missing method: ${String(prop)}`);
             return new Proxy({}, dummyNodeHandler);
          };
        }
      };

      // @ts-expect-error - Mocking AudioContext
      window.AudioContext = new Proxy(MockAudioContext, {
          construct(target: any, args: any[]) {
              return new Proxy(new target(...args), proxyHandler);
          }
      });
      // @ts-expect-error - Mocking webkitAudioContext
      window.webkitAudioContext = window.AudioContext;
    });

    // Enable console logging from the browser
    page.on('console', msg => console.log(`BROWSER_LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER_ERROR: ${err}`));

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
            // A more substantial dummy WAV base64 (approx 44 bytes header + some zero data)
            vocals: 'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 
            instrumental: 'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
          }
        })
      });
    });

    // Mock available models - HIJACK DEFAULT ID to be SERVER TYPE
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

    // Mock model downloads to fail fast
    await page.route('**/models/**/*.onnx', route => route.abort());
    await page.route('**/models/**/*.wasm', route => route.abort());
  });

  test('should go to separation progress screen on upload', async ({ page }) => {
    await page.goto('/', { timeout: 60000 });

    // Create a dummy file for upload
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');
    
    // We expect the app to transition to processing or results.
    // Since our mock returns 'completed' immediately, it might jump to results.
    // We check for either the processing message OR a results indicator.
    
    
    // Check for the "Separation Complete" heading or "WAV" button.
    // "Separation Complete" is a heading in ResultsDisplay.
    await expect(page.getByRole('heading', { name: /Separation Complete/i })).toBeVisible({ timeout: 20000 });
    
    // Verification of "WAV" download button presence.
    await expect(page.getByRole('button', { name: /WAV/i }).first()).toBeVisible();
  });
});
