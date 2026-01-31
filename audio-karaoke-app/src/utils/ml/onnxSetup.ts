import * as ort from 'onnxruntime-web';

/**
 * Checks if the browser supports WebGPU, which is required for high-performance ML.
 * Explicitly requests a high-performance adapter if available.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return false;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adapter = await (navigator as any).gpu.requestAdapter({
            powerPreference: 'high-performance'
        });

        if (adapter) {
            const info = await adapter.requestAdapterInfo();
            console.log(`[WebGPU] Adapter found: ${info.vendor} ${info.architecture}`);
        }

        return !!adapter;
    } catch (e) {
        console.warn('WebGPU requestAdapter failed:', e);
        return false;
    }
}

/**
 * Configures ONNX Runtime to use the best available execution provider.
 * Sets WASM paths and thread counts.
 */
export async function setupONNX(): Promise<ort.InferenceSession.SessionOptions> {
    const hasWebGPU = await checkWebGPUSupport();
    console.log('[onnxSetup] Setting up ONNX Runtime...');

    // Configure WASM paths to point to our public/wasm directory
    // In workers, we might need a full URL to avoid relative path issues
    const wasmPath = typeof self !== 'undefined' && self.location ? `${self.location.origin}/wasm/` : '/wasm/';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ort as any).env.wasm.wasmPaths = wasmPath;
    console.log('[onnxSetup] WASM paths set to:', (ort as any).env.wasm.wasmPaths);

    // Enable SIMD for better performance on CPU fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ort as any).env.wasm.numThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ort as any).env.wasm.simd = true;

    // Set proxy flags to avoid some browser restrictions if needed
    // (ort as any).env.wasm.proxy = true; 

    console.log('[onnxSetup] Threads:', (ort as any).env.wasm.numThreads, 'SIMD:', (ort as any).env.wasm.simd);

    const options: ort.InferenceSession.SessionOptions = {
        executionProviders: hasWebGPU
            ? [
                {
                    name: 'webgpu',
                    devicePreference: 'high-performance',
                    preferredLayout: 'NCHW'
                } as unknown as string, // Cast to avoid TS strict type checking on experimental options
                'wasm'
            ]
            : ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential', // Parallel can cause issues in some envs
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(`[onnxSetup] ONNX Setup: WebGPU=${hasWebGPU}, Threads=${(ort as any).env.wasm.numThreads}`);

    return options;
}

/**
 * Comprehensive support check for ONNX Runtime capabilities.
 */
export async function checkONNXSupport() {
    const webgpu = await checkWebGPUSupport();
    const threads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1;

    return {
        webgpu,
        wasm: true, // Always true if script loaded
        threads,
        simd: true, // We attempt to enable it
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    };
}
