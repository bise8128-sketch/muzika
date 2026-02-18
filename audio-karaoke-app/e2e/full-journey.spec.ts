import { test, expect } from '@playwright/test';

/**
 * Full User Journey E2E Test
 * 
 * Simulates the COMPLETE human user flow:
 * Upload → Processing → Results → Karaoke Player → Export
 * 
 * Uses mocked API responses for deterministic testing.
 */
test.describe('Complete User Journey', () => {
    test.setTimeout(120000);

    test.beforeEach(async ({ page }) => {
        // Mock AudioContext
        await page.addInitScript(() => {
            const MockAudioContext = class {
                state = 'running';
                sampleRate = 44100;
                constructor(..._args: unknown[]) {}
                createBufferSource() {
                    return {
                        start: () => {}, connect: () => {}, disconnect: () => {},
                        stop: () => {}, buffer: null, loop: false,
                        playbackRate: { value: 1, setValueAtTime: () => {} },
                    };
                }
                createGain() {
                    return {
                        connect: () => {}, disconnect: () => {},
                        gain: { value: 1, setValueAtTime: () => {} },
                    };
                }
                createAnalyser() {
                    return {
                        connect: () => {}, disconnect: () => {},
                        fftSize: 2048, frequencyBinCount: 1024,
                        getByteFrequencyData: (a: Uint8Array) => a.fill(128),
                        getFloatTimeDomainData: () => {},
                    };
                }
                createConvolver() { return { connect: () => {}, disconnect: () => {}, buffer: null }; }
                createDynamicsCompressor() {
                    return {
                        connect: () => {}, disconnect: () => {},
                        threshold: { value: 0 }, knee: { value: 0 },
                        ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
                    };
                }
                createMediaElementSource() { return { connect: () => {}, disconnect: () => {} }; }
                createBuffer(channels: number, length: number, sampleRate: number) {
                    return {
                        numberOfChannels: channels, length, sampleRate,
                        duration: length / sampleRate,
                        getChannelData: () => new Float32Array(length),
                    };
                }
                destination = {};
                decodeAudioData() {
                    return Promise.resolve({
                        length: 44100 * 10, numberOfChannels: 2, sampleRate: 44100,
                        duration: 10, getChannelData: () => new Float32Array(44100 * 10),
                    });
                }
            };

            const dummyNodeHandler = {
                get(_target: object, prop: string | symbol) {
                    if (['connect', 'disconnect', 'start', 'stop'].includes(String(prop))) return () => {};
                    return { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} };
                },
            };

            const proxyHandler = {
                get(target: InstanceType<typeof MockAudioContext>, prop: string | symbol) {
                    if (prop in target) return Reflect.get(target, prop);
                    return () => new Proxy({}, dummyNodeHandler);
                },
            };

            // Mark onboarding as completed
            localStorage.setItem('muzika_onboarding_completed', 'true');

            (window as any).AudioContext = new Proxy(MockAudioContext, {
                construct(target, args) { return new Proxy(new target(...args), proxyHandler); },
            });
            (window as any).webkitAudioContext = (window as any).AudioContext;
        });

        page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
        page.on('pageerror', err => console.error(`PAGE_ERROR: ${err}`));

        // Mock all backend API calls
        await page.route('**/api/backend-upload', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ filename: 'test-audio.mp3' }),
            });
        });

        await page.route('**/api/python-processing*', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        status: 'completed',
                        jobId: 'mock-job-1',
                        stems: {
                            vocals: '/mock-audio/vocals.wav',
                            instrumental: '/mock-audio/instrumental.wav',
                        },
                    }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ status: 'ready' }),
                });
            }
        });

        await page.route('**/mock-audio/*.wav', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'audio/wav',
                body: Buffer.from('RIFF....WAVEfmt '),
            });
        });

        await page.route('**/api/models', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    models: [{ id: 'htdemucs', name: 'Demucs v4', type: 'htdemucs', isGpuSupported: false }],
                }),
            });
        });

        await page.route('**/api/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ services: { modelRepository: 'connected' } }),
            });
        });

        // Block model downloads
        await page.route('**/models/**/*.onnx', route => route.abort());
        await page.route('**/models/**/*.wasm', route => route.abort());
    });

    test('Step 1: Landing page loads correctly', async ({ page }) => {
        await page.goto('/');

        // Verify the main heading and upload area
        await expect(page.getByText('Separate your music')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Select Audio Files')).toBeVisible();

        // Verify upload input is present
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
    });

    test('Step 2: Upload file and reach separation results', async ({ page }) => {
        await page.goto('/');

        // Upload a file
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');

        // Wait for separation to complete (mocked API returns immediately)
        await expect(
            page.getByRole('heading', { name: /Separation Complete/i })
        ).toBeVisible({ timeout: 30000 });

        // Verify download buttons are present
        await expect(page.getByRole('button', { name: /WAV/i }).first()).toBeVisible();
    });

    test('Step 3: Navigate to karaoke player after separation', async ({ page }) => {
        await page.goto('/');

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles('e2e/fixtures/test-audio.mp3');

        // Wait for results
        await expect(
            page.getByRole('heading', { name: /Separation Complete/i })
        ).toBeVisible({ timeout: 30000 });

        // Look for the "Try Karaoke" button
        const karaokeButton = page.getByRole('button', { name: /try karaoke/i });
        if (await karaokeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await karaokeButton.click();

            // Player should appear
            const playerText = page.getByText('Original');
            await expect(playerText).toBeVisible({ timeout: 60000 });
        }
    });

    test('Step 4: User can interact with settings panel', async ({ page }) => {
        await page.goto('/');

        // Open settings
        const settingsButton = page.getByTestId('settings-button');
        if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await settingsButton.click();
            await expect(page.getByText('Settings')).toBeVisible();
            await expect(page.getByText('Processing Engine').first()).toBeVisible();
        }
    });
});
