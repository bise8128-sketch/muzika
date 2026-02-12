import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';
import { validateYouTubeUrl, sanitizeErrorMessage, RateLimiter } from '@/utils/security/sanitize';

/**
 * YouTube Extraction API (Refactored)
 * 
 * This endpoint delegates the actual downloading and conversion to the Python microservice.
 * It acts as a gateway, providing validation and a unified interface for the frontend.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Rate limiter for YouTube downloads
 * Limits: 10 requests per minute per IP
 */
const rateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10
});

/**
 * Allowed audio formats
 */
const ALLOWED_FORMATS = ['mp3', 'wav', 'aac', 'flac', 'ogg'] as const;
type AudioFormat = typeof ALLOWED_FORMATS[number];

/**
 * Request validation schema
 */
interface YouTubeDownloadRequest {
    url: string;
    format?: AudioFormat;
}

/**
 * Validates the request body
 */
function validateRequest(body: unknown): { 
    valid: boolean; 
    data?: YouTubeDownloadRequest; 
    error?: string 
} {
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Invalid request body' };
    }

    const { url, format = 'mp3' } = body as Record<string, unknown>;

    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required' };
    }

    // Validate format
    if (!ALLOWED_FORMATS.includes(format as AudioFormat)) {
        return { 
            valid: false, 
            error: `Invalid format. Allowed: ${ALLOWED_FORMATS.join(', ')}` 
        };
    }

    return { 
        valid: true, 
        data: { url, format: format as AudioFormat } 
    };
}

interface PythonError {
    detail?: string;
    error?: string;
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
                error: 'Too many requests. Please wait before trying again.',
                retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            },
            { 
                status: 429,
                headers: {
                    'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
                    'X-RateLimit-Limit': '10',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
                }
            }
        );
    }

    console.log('[API] /api/extract-youtube called');

    try {
        const body = await request.json();

        // 1. Validate request structure
        const validation = validateRequest(body);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        const { url, format } = validation.data!;

        // 2. Validate YouTube URL and extract video ID
        const urlValidation = validateYouTubeUrl(url);
        if (!urlValidation.valid) {
            return NextResponse.json(
                { error: urlValidation.error || 'Invalid YouTube URL' },
                { status: 400 }
            );
        }

        console.log(`[API] Valid YouTube URL. Video ID: ${urlValidation.videoId}`);

        // 3. Delegate to Python Service with Timeout & Retry
        console.log(`[API] Forwarding download request to Python service: ${PYTHON_SERVICE_URL}/api/download`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for download

        try {
            const response = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url, 
                    format,
                    videoId: urlValidation.videoId // Pass validated video ID
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as PythonError;
                console.error('[API] Python service error:', errorData);

                // Map status codes to user-friendly messages
                if (response.status === 429) {
                    return NextResponse.json(
                        { error: 'Too many requests. Please try again later.' },
                        { status: 429 }
                    );
                }

                if (response.status === 403) {
                    return NextResponse.json(
                        { error: 'This video is not available for download.' },
                        { status: 403 }
                    );
                }

                if (response.status === 404) {
                    return NextResponse.json(
                        { error: 'Video not found.' },
                        { status: 404 }
                    );
                }

                return NextResponse.json(
                    { error: sanitizeErrorMessage(errorData.detail || errorData.error) },
                    { status: Math.min(response.status, 500) }
                );
            }

            const data = await response.json();

            // 4. Construct proxy URL for the file
            // Validate the returned path
            const filePath = data.path;
            if (!filePath || typeof filePath !== 'string') {
                return NextResponse.json(
                    { error: 'Invalid response from download service' },
                    { status: 500 }
                );
            }

            // Ensure path doesn't contain traversal attempts
            if (filePath.includes('..') || filePath.includes('\0')) {
                console.error('[API] Invalid file path in response:', filePath);
                return NextResponse.json(
                    { error: 'Invalid file path in response' },
                    { status: 500 }
                );
            }

            const fileUrl = `/api/backend-files/${filePath}`;

            return NextResponse.json({
                status: 'success',
                filename: data.filename,
                url: fileUrl,
                videoId: urlValidation.videoId,
                source: 'python-service'
            }, {
                headers: {
                    'X-RateLimit-Limit': '10',
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
                }
            });

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);

            if (fetchError instanceof Error) {
                if (fetchError.name === 'AbortError') {
                    return NextResponse.json(
                        { error: 'Download timed out. The video may be too long.' },
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
        console.error('[API] YouTube extraction error:', error);
        return NextResponse.json(
            { error: sanitizeErrorMessage(error) },
            { status: 500 }
        );
    }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Allow': 'POST, OPTIONS',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
