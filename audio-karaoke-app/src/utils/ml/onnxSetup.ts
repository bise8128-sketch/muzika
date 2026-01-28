import * as ort from 'onnxruntime-web';

/**
 * Checks if the browser supports WebGPU, which is required for high-performance ML.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return false;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adapter = await (navigator as any).gpu.requestAdapter();
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

    // Configure WASM paths to point to our public/wasm directory
    // Note: onnxruntime-web looks for these files relative to the host or via env.wasmPaths
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ort as any).env.wasm.wasmPaths = '/wasm/';

    // Enable SIMD for better performance on CPU fallback
    (ort as any).env.wasm.numThreads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    (ort as any).env.wasm.simd = true;

    const options: ort.InferenceSession.SessionOptions = {
        executionProviders: hasWebGPU ? ['webgpu', 'wasm'] : ['wasm'],
        graphOptimizationLevel: 'all',
    };

    console.log(`ONNX Setup: WebGPU=${hasWebGPU}, Threads=${(ort as any).env.wasm.numThreads}`);

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
