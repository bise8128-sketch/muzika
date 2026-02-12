import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';
import { 
    validateYouTubeUrl, 
    validateFilePath, 
    sanitizeErrorMessage, 
    RateLimiter 
} from '@/utils/security/sanitize';

/**
 * Python Processing API (Refactored)
 * 
 * This endpoint delegates audio separation (vocal/instrumental) to the Python microservice.
 * Includes comprehensive input validation and error handling.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Rate limiter for processing requests
 * Limits: 5 requests per 5 minutes per IP (processing is expensive)
 */
const rateLimiter = new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5
});

/**
 * Allowed separation models
 */
const ALLOWED_MODELS = [
    'htdemucs',
    'htdemucs_ft',
    'mdx', 
    'mdx_extra',
    'mdx_q',
    'mdx_extra_q',
    'bs_roformer'
] as const;
type SeparationModel = typeof ALLOWED_MODELS[number];

/**
 * Allowed output formats
 */
const ALLOWED_FORMATS = ['mp3', 'wav', 'flac'] as const;
type OutputFormat = typeof ALLOWED_FORMATS[number];

/**
 * Request validation schema
 */
interface ProcessingRequest {
    url?: string;
    filename?: string;
    model?: SeparationModel;
    format?: OutputFormat;
}

/**
 * Validates the request body
 */
function validateRequest(body: unknown): { 
    valid: boolean; 
    data?: ProcessingRequest; 
    error?: string 
} {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Invalid request body' };
    }

    const { url, filename, model = 'htdemucs', format = 'mp3' } = body as Record<string, unknown>;

    // Must have either URL or filename
    if (!url && !filename) {
        return { valid: false, error: 'Either URL or filename is required' };
    }

    // Validate URL if provided
    if (url !== undefined && url !== null) {
        if (typeof url !== 'string') {
            return { valid: false, error: 'URL must be a string' };
        }
        
        const urlValidation = validateYouTubeUrl(url);
        if (!urlValidation.valid) {
            return { valid: false, error: urlValidation.error || 'Invalid URL' };
        }
    }

    // Validate filename if provided
    if (filename !== undefined && filename !== null) {
        if (typeof filename !== 'string') {
            return { valid: false, error: 'Filename must be a string' };
        }

        // Validate filename format (alphanumeric, underscores, hyphens, extension)
        const filenameValidation = validateFilePath([filename], {
            allowedExtensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
            maxPathLength: 100
        });

        if (!filenameValidation.valid) {
            return { valid: false, error: `Invalid filename: ${filenameValidation.error}` };
        }
    }

    // Validate model
    if (!ALLOWED_MODELS.includes(model as SeparationModel)) {
        return { 
            valid: false, 
            error: `Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}` 
        };
    }

    // Validate format
    if (!ALLOWED_FORMATS.includes(format as OutputFormat)) {
        return { 
            valid: false, 
            error: `Invalid format. Allowed: ${ALLOWED_FORMATS.join(', ')}` 
        };
    }

    return { 
        valid: true, 
        data: { 
            url: typeof url === 'string' ? url : undefined, 
            filename: typeof filename === 'string' ? filename : undefined, 
            model: model as SeparationModel, 
            format: format as OutputFormat 
        } 
    };
}

interface PythonError {
    detail?: string;
    error?: string;
}

interface PythonDownloadResponse {
    filename: string;
    path: string;
}

interface PythonSeparateResponse {
    stems: Record<string, string>;
    jobId?: string;
}

export async function POST(request: NextRequest) {
    // Get client identifier for rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || request.headers.get('x-real-ip') 
        || 'unknown';
    
    // Check rate limit
    const rateLimitResult = rateLimiter.check(clientIp);
    if (!rateLimitResult.allowed) {
        return NextResponse.json(
            { 
                error: 'Too many processing requests. Please wait before trying again.',
                retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            },
            { 
                status: 429,
                headers: {
                    'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
                    'X-RateLimit-Limit': '5',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
                }
            }
        );
    }

    try {
        const body = await request.json();

        // 1. Validate request
        const validation = validateRequest(body);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const { url, filename, model, format } = validation.data!;

        // 2. If we have a URL, first download the file
        let fileToProcess = filename;
        if (url) {
            console.log(`[API] Downloading from URL: ${url}`);

            try {
                const downloadResponse = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, format })
                });

                if (!downloadResponse.ok) {
                    const errorData = await downloadResponse.json().catch(() => ({ error: 'Download failed' })) as PythonError;
                    console.error('[API] Python download error:', errorData);
                    return NextResponse.json(
                        { error: sanitizeErrorMessage(errorData.detail || errorData.error) },
                        { status: Math.min(downloadResponse.status, 500) }
                    );
                }

                const downloadData = await downloadResponse.json() as PythonDownloadResponse;
                
                // Validate the returned filename
                if (!downloadData.filename || typeof downloadData.filename !== 'string') {
                    return NextResponse.json(
                        { error: 'Invalid response from download service' },
                        { status: 500 }
                    );
                }

                fileToProcess = downloadData.filename;
                console.log(`[API] Downloaded file: ${fileToProcess}`);
            } catch (downloadError) {
                console.error('[API] Download error:', downloadError);
                return NextResponse.json(
                    { error: sanitizeErrorMessage(downloadError) },
                    { status: 500 }
                );
            }
        }

        if (!fileToProcess) {
            return NextResponse.json(
                { error: 'No file available for processing' },
                { status: 400 }
            );
        }

        console.log(`[API] Starting separation for: ${fileToProcess} with model: ${model}`);

        // 3. Set a long timeout for separation
        const controller = new AbortController();
        const timeoutMs = parseInt(process.env.SEPARATION_TIMEOUT_MS || '300000', 10); // 5 minutes default
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/separate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: fileToProcess, model }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as PythonError;
                console.error('[API] Python separation error:', errorData);
                return NextResponse.json(
                    { error: sanitizeErrorMessage(errorData.detail || 'Separation failed') },
                    { status: Math.min(response.status, 500) }
                );
            }

            const data = await response.json() as PythonSeparateResponse;

            // 4. Validate and map stem paths
            const stems: Record<string, string> = {};
            if (data.stems && typeof data.stems === 'object') {
                for (const [key, value] of Object.entries(data.stems)) {
                    // Validate each stem path
                    if (typeof value !== 'string') continue;
                    
                    // Check for path traversal
                    if (value.includes('..') || value.includes('\0')) {
                        console.error(`[API] Invalid stem path for ${key}: ${value}`);
                        continue;
                    }

                    // Only allow specific stem keys
                    const allowedStemKeys = ['vocals', 'drums', 'bass', 'other', 'accompaniment', 'no_vocals'];
                    if (allowedStemKeys.includes(key)) {
                        stems[key] = `/api/backend-files/${value}`;
                    }
                }
            }

            if (Object.keys(stems).length === 0) {
                return NextResponse.json(
                    { error: 'No valid stems returned from separation' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                status: 'completed',
                stems,
                jobId: data.jobId || 'legacy',
                source: 'python-service',
                filename: fileToProcess
            }, {
                headers: {
                    'X-RateLimit-Limit': '5',
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
                }
            });

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            
            if (fetchError instanceof Error) {
                if (fetchError.name === 'AbortError') {
                    return NextResponse.json(
                        { error: 'Separation process timed out. The audio may be too long.' },
                        { status: 504 }
                    );
                }
                if (fetchError.name === 'CircuitOpenError') {
                    return NextResponse.json(
                        { error: 'Service is currently unavailable. Please try again later.' },
                        { status: 503 }
                    );
                }
            }
            throw fetchError;
        }

    } catch (error: unknown) {
        console.error('[API] Python processing error:', error);
        return NextResponse.json(
            { error: sanitizeErrorMessage(error) },
            { status: 500 }
        );
    }
}

/**
 * GET endpoint for health check and job status
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
        // Query job status from Python service
        try {
            const response = await fetch(`${PYTHON_SERVICE_URL}/api/status/${jobId}`);
            if (!response.ok) {
                return NextResponse.json(
                    { error: 'Job not found' },
                    { status: 404 }
                );
            }
            const data = await response.json();
            return NextResponse.json(data);
        } catch (error) {
            console.error('[API] Status check error:', error);
            return NextResponse.json(
                { error: sanitizeErrorMessage(error) },
                { status: 500 }
            );
        }
    }

    return NextResponse.json({ 
        status: 'ready', 
        message: 'Use POST to start processing',
        models: ALLOWED_MODELS,
        formats: ALLOWED_FORMATS
    });
}
