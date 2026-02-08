import { FileValidator, ValidationConfig } from '../FileValidator';

describe('FileValidator', () => {
    let validator: FileValidator;
    const defaultConfig: ValidationConfig = {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['audio/mpeg', 'audio/wav'],
    };

    beforeEach(() => {
        validator = new FileValidator(defaultConfig);

        // Mock URL methods
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = jest.fn();

        // Mock Audio
        // @ts-ignore
        global.Audio = class {
            onloadedmetadata: (() => void) | null = null;
            onerror: ((e: any) => void) | null = null;
            duration: number = 0;
            src: string = '';

            constructor(src: string) {
                this.src = src;
                setTimeout(() => {
                    if (this.onloadedmetadata) {
                        this.duration = 120; // Default 2 mins
                        this.onloadedmetadata();
                    }
                }, 0);
            }
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should validate a valid file', async () => {
        const file = new File(['dummy content'], 'song.mp3', { type: 'audio/mpeg' });
        const result = await validator.validate(file);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should fail when file size exceeds limit', async () => {
        // Mock a large file by overriding size property
        const file = new File([''], 'large.mp3', { type: 'audio/mpeg' });
        Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 });

        const result = await validator.validate(file);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('File size');
    });

    it('should fail when mime type is not allowed', async () => {
        const file = new File([''], 'video.mp4', { type: 'video/mp4' });
        const result = await validator.validate(file);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('File type');
    });

    it('should validate storage quota if configured', async () => {
        const configWithStorage: ValidationConfig = {
            ...defaultConfig,
            minFreeStorage: 1024 * 1024, // 1MB buffer
        };
        validator = new FileValidator(configWithStorage);

        // Mock storage
        const mockEstimate = jest.fn().mockResolvedValue({
            quota: 100 * 1024 * 1024, // 100MB
            usage: 90 * 1024 * 1024,  // 90MB used -> 10MB free
        });

        Object.defineProperty(navigator, 'storage', {
            value: { estimate: mockEstimate },
            configurable: true,
            writable: true
        });

        const file = new File(['x'.repeat(1024)], 'test.mp3', { type: 'audio/mpeg' }); // 1KB file
        // Required: 1KB * 3 + 1MB ~= 1MB. Available 10MB. Should pass.

        let result = await validator.validate(file);
        expect(result.isValid).toBe(true);

        // Now test insufficient storage
        mockEstimate.mockResolvedValue({
            quota: 100 * 1024 * 1024,
            usage: 99.9 * 1024 * 1024, // 0.1MB free
        });

        result = await validator.validate(file);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Not enough storage'))).toBe(true);
    });

    it('should warn on low device memory', async () => {
        // Mock deviceMemory
        Object.defineProperty(navigator, 'deviceMemory', {
            value: 1, // 1GB
            configurable: true,
            writable: true
        });

        const result = await validator.validate(new File([''], 't.mp3', { type: 'audio/mpeg' }));
        expect(result.warnings.some(w => w.includes('Low device memory'))).toBe(true);
    });

    it('should validate audio duration', async () => {
        const configWithDuration: ValidationConfig = {
            ...defaultConfig,
            audioConstraints: {
                minDuration: 10,
                maxDuration: 60
            }
        };
        validator = new FileValidator(configWithDuration);

        // Mock Audio to return specific duration
        // @ts-ignore
        global.Audio = class {
            onloadedmetadata: (() => void) | null = null;
            duration: number = 0;
            constructor() {
                setTimeout(() => {
                    this.duration = 5; // Too short
                    if (this.onloadedmetadata) this.onloadedmetadata();
                }, 0);
            }
        };

        const file = new File([''], 'short.mp3', { type: 'audio/mpeg' });
        let result = await validator.validate(file);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('too short'))).toBe(true);

        // Test too long
        // @ts-ignore
        global.Audio = class {
            onloadedmetadata: (() => void) | null = null;
            duration: number = 0;
            constructor() {
                setTimeout(() => {
                    this.duration = 100; // Too long
                    if (this.onloadedmetadata) this.onloadedmetadata();
                }, 0);
            }
        };

        result = await validator.validate(file);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('too long'))).toBe(true);
    });
});
