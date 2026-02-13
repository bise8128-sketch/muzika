import * as ort from 'onnxruntime-web';

/**
 * Checks if the browser supports WebGPU, which is required for high-performance ML.
 * Explicitly requests a high-performance adapter if available.
 */
export async function checkWebGPUSupport(): Promise<boolean> {
    const nav = typeof navigator !== 'undefined' ? navigator : (typeof self !== 'undefined' ? (self as any).navigator : null);
    if (!nav || !('gpu' in nav)) {
        return false;
    }
    try {
        console.log('[WebGPU] Requesting high-performance adapter...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let adapter = await nav.gpu.requestAdapter({
            powerPreference: 'high-performance'
        });

        if (!adapter) {
            console.warn('[WebGPU] High-performance adapter not found, trying default...');
            adapter = await nav.gpu.requestAdapter();
        }

        if (adapter) {
            const info = await adapter.requestAdapterInfo();
            console.log(`[WebGPU] Adapter found: ${info.vendor} ${info.architecture} (${info.description})`);

            // Check for required features if any specific ones are known to be needed
            console.log('[WebGPU] Adapter features:', Array.from((adapter as any).features));
        } else {
            console.log('[WebGPU] No GPU adapter found. This is expected on many devices. Falling back to CPU (WASM).');
        }

        return !!adapter;
    } catch (e) {
        console.warn('[WebGPU] requestAdapter failed. This usually means WebGPU is disabled or not supported by the browser.', e);
        console.log('[WebGPU] Falling back to CPU (WASM) execution.');
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

    // Set log level based on environment or settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDev = process.env.NODE_ENV === 'development';
    // Use 'warning' or 'error' to avoid verbose logs like "Unknown CPU vendor" which are harmless
    (ort as any).env.logLevel = isDev ? 'warning' : 'error';

    // Enable WebGPU profiling in development
    if (hasWebGPU) {
        (ort as any).env.webgpu.profiling = isDev ? 'verbose' : 'off';
    }

    // Configure WASM paths to point to our public/wasm directory
    // In workers, we might need a full URL to avoid relative path issues
    const wasmPath = typeof self !== 'undefined' && self.location ? `${self.location.origin}/wasm/` : '/wasm/';

    console.log('[onnxSetup] Computed WASM path:', wasmPath);

    // Diagnostic: Check if we can fetch the JSEP file
    try {
        const checkUrl = `${wasmPath}ort-wasm-simd-threaded.jsep.mjs`;
        console.log('[onnxSetup] Diagnostic: Attempting to fetch', checkUrl);
        const response = await fetch(checkUrl, { method: 'HEAD' });
        console.log(`[onnxSetup] Diagnostic fetch status: ${response.status} ${response.statusText}`);
        console.log('[onnxSetup] Diagnostic Content-Type:', response.headers.get('content-type'));

        if (!response.ok) {
            console.error('[onnxSetup] Diagnostic: File not accessible. This is likely the cause of the "Failed to fetch dynamically imported module" error.');
        }
    } catch (e) {
        console.error('[onnxSetup] Diagnostic fetch failed:', e);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ort as any).env.wasm.wasmPaths = wasmPath;
    console.log('[onnxSetup] WASM paths set to:', (ort as any).env.wasm.wasmPaths);

    // Enable SIMD for better performance on CPU fallback
    // Check for crossOriginIsolated for multi-threading
    const isIsolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ort as any).env.wasm.numThreads = isIsolated && typeof navigator !== 'undefined'
        ? Math.min(navigator.hardwareConcurrency || 4, 8) // Cap at 8 for better efficiency
        : 1;

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
                } as unknown as string,
                'wasm'
            ]
            : ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential',
        // Optimize memory for fixed batch size of 1
        freeDimensionOverrides: {
            // Override symbolic dimensions for better optimization
            // Common names for batch dimension
            batch_size: 1,
            batch: 1,
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(`[onnxSetup] ONNX Setup: WebGPU=${hasWebGPU}, Threads=${(ort as any).env.wasm.numThreads}`);

    return options;
}


import type { ExecutionBackend } from '@/types/model';
export type { ExecutionBackend };

/**
 * Validates which Execution Provider is actually being used by a session.
 * Useful to detect if WebGPU silently fell back to WASM/CPU.
 */
export function validateSessionProvider(
    session: ort.InferenceSession,
    requestedWebGPU: boolean
): { backend: ExecutionBackend; didFallback: boolean } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionAny = session as any;
    
    // Check internal session state for execution providers
    // Usually defined in session.executionProviders array
    const providers = sessionAny.executionProviders || [];
    
    const isUsingWebGPU = providers.some((ep: string | { name: string }) => 
        ep === 'webgpu' || (typeof ep === 'object' && ep.name === 'webgpu')
    );

    if (requestedWebGPU && !isUsingWebGPU) {
        return { backend: 'wasm', didFallback: true };
    }

    if (isUsingWebGPU) {
        return { backend: 'webgpu', didFallback: false };
    }

    return { backend: 'wasm', didFallback: false };
}

export interface ONNXSupport {
    webgpu: boolean;
    wasm: boolean;
    threads: number;
    simd: boolean;
    platform: string;
    isLowEnd: boolean;
}

/**
 * Comprehensive support check for ONNX Runtime capabilities.
 */
export async function checkONNXSupport(): Promise<ONNXSupport> {
    const webgpu = await checkWebGPUSupport();
    const threads = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1;

    // Check for low-end device indicators
    // deviceMemory is in GB. threads < 4 is another indicator.
    // userAgent check for mobile devices.
    const isLowEnd = typeof navigator !== 'undefined' && (
        ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4) ||
        threads < 4 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );

    return {
        webgpu,
        wasm: true, // Always true if script loaded
        threads,
        simd: true, // We attempt to enable it
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
        isLowEnd
    };
}
