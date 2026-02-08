import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';

/**
 * YouTube Extraction API (Refactored)
 * 
 * This endpoint now delegates the actual downloading and conversion to the Python microservice.
 * It acts as a gateway, providing validation and a unified interface for the frontend.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

interface PythonError {
    detail?: string;
}

// YouTube URL validation
function isValidYouTubeUrl(url: string): boolean {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
        /^(https?:\/\/)?youtu\.be\/.+$/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=.+$/,
    ];
    return patterns.some(pattern => pattern.test(url));
}

export async function POST(request: NextRequest) {
    console.log('[API] /api/extract-youtube (refactored) called');
    try {
        const body = await request.json();
        const { url, format = 'mp3' } = body;

        // 1. Validation
        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        if (!isValidYouTubeUrl(url)) {
            return NextResponse.json({ error: 'Invalid YouTube URL format' }, { status: 400 });
        }

        // 2. Delegate to Python Service with Timeout & Retry
        console.log(`[API] Forwarding download request to Python service: ${PYTHON_SERVICE_URL}/api/download`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for download

        try {
            const response = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as PythonError;
                console.error('[API] Python service error:', errorData);

                // Map status codes
                if (response.status === 429) {
                    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
                }

                return NextResponse.json(
                    { error: errorData.detail || 'Python service failed to process request' },
                    { status: response.status }
                );
            }

            const data = await response.json();

            // 3. Construct proxy URL for the file
            const fileUrl = `/api/backend-files/${data.path}`;

            return NextResponse.json({
                status: 'success',
                filename: data.filename,
                url: fileUrl,
                source: 'python-service'
            });

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);

            if (fetchError instanceof Error) {
                if (fetchError.name === 'AbortError') {
                    return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
                }
                if (fetchError.name === 'CircuitOpenError') {
                    return NextResponse.json({ error: 'Service is currently unavailable (Circuit Breaker Open)' }, { status: 503 });
                }
            }

            throw fetchError;
        }

    } catch (error: unknown) {
        console.error('YouTube extraction error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Failed to connect to audio processing service: ${message}` },
            { status: 503 }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
