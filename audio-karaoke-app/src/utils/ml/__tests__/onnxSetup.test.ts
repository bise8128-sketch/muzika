
import { validateSessionProvider, checkONNXSupport, ExecutionBackend } from '../onnxSetup';
import * as ort from 'onnxruntime-web';

// Mock checkWebGPUSupport since it uses navigator stuff
jest.mock('../onnxSetup', () => {
    const originalModule = jest.requireActual('../onnxSetup');
    return {
        ...originalModule,
        checkWebGPUSupport: jest.fn(),
    };
});

describe('onnxSetup', () => {
    describe('validateSessionProvider', () => {
        it('should detect WebGPU usage correctly', () => {
            const mockSession = {
                executionProviders: ['webgpu', 'cpu']
            } as unknown as ort.InferenceSession;

            const result = validateSessionProvider(mockSession, true);
            expect(result.backend).toBe('webgpu');
            expect(result.didFallback).toBe(false);
        });

        it('should detect WebGPU usage when provider is object', () => {
            const mockSession = {
                executionProviders: [{ name: 'webgpu' }, 'cpu']
            } as unknown as ort.InferenceSession;

            const result = validateSessionProvider(mockSession, true);
            expect(result.backend).toBe('webgpu');
            expect(result.didFallback).toBe(false);
        });

        it('should detect silent fallback to WASM when WebGPU requested', () => {
            const mockSession = {
                executionProviders: ['wasm', 'cpu']
            } as unknown as ort.InferenceSession;

            const result = validateSessionProvider(mockSession, true);
            expect(result.backend).toBe('wasm');
            expect(result.didFallback).toBe(true);
        });

        it('should return WASM if WebGPU not requested', () => {
            const mockSession = {
                executionProviders: ['wasm', 'cpu']
            } as unknown as ort.InferenceSession;

            const result = validateSessionProvider(mockSession, false);
            expect(result.backend).toBe('wasm');
            expect(result.didFallback).toBe(false);
        });
        
        it('should handle missing executionProviders array', () => {
             const mockSession = {} as unknown as ort.InferenceSession;
             const result = validateSessionProvider(mockSession, true);
             expect(result.backend).toBe('wasm');
             expect(result.didFallback).toBe(true);
        });
    });
});
