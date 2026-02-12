import { NextRequest, NextResponse } from 'next/server';
import { validateFilePath, sanitizeErrorMessage } from '@/utils/security/sanitize';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

/**
 * Allowed file extensions for the backend file proxy
 * Only audio and related files are permitted
 */
const ALLOWED_EXTENSIONS = [
    'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma',
    'json', 'txt' // Allow metadata files
];

/**
 * Maximum path length to prevent DoS
 */
const MAX_PATH_LENGTH = 255;

/**
 * Maximum file size to proxy (50MB)
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;

        // Validate path segments to prevent path traversal
        const validation = validateFilePath(pathSegments, {
            allowedExtensions: ALLOWED_EXTENSIONS,
            maxPathLength: MAX_PATH_LENGTH,
            allowAbsolute: false
        });

        if (!validation.valid) {
            console.warn(`[backend-files] Path validation failed: ${validation.error}`);
            return NextResponse.json(
                { error: 'Invalid file path' },
                { status: 400 }
            );
        }

        // Build the backend URL with validated path
        const url = `${PYTHON_SERVICE_URL}/files/${validation.path}`;

        // Create request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    // Forward range headers for audio seeking
                    ...(request.headers.get('range') && { 'Range': request.headers.get('range')! }),
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    return NextResponse.json({ error: 'File not found' }, { status: 404 });
                }
                if (response.status === 403) {
                    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
                }
                return NextResponse.json(
                    { error: 'Failed to retrieve file' },
                    { status: response.status }
                );
            }

            // Check content length
            const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
            if (contentLength > MAX_FILE_SIZE) {
                console.warn(`[backend-files] File too large: ${contentLength} bytes`);
                return NextResponse.json(
                    { error: 'File too large' },
                    { status: 413 }
                );
            }

            // Build response headers
            const headers = new Headers();
            
            // Content type
            const contentType = response.headers.get('Content-Type');
            if (contentType) {
                headers.set('Content-Type', contentType);
            } else {
                // Infer from extension
                const ext = validation.path.split('.').pop()?.toLowerCase();
                const mimeTypes: Record<string, string> = {
                    'mp3': 'audio/mpeg',
                    'wav': 'audio/wav',
                    'flac': 'audio/flac',
                    'ogg': 'audio/ogg',
                    'm4a': 'audio/mp4',
                    'aac': 'audio/aac',
                    'json': 'application/json',
                    'txt': 'text/plain'
                };
                headers.set('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
            }

            // Content length
            if (contentLength > 0) {
                headers.set('Content-Length', contentLength.toString());
            }

            // Range support for audio seeking
            const contentRange = response.headers.get('Content-Range');
            if (contentRange) {
                headers.set('Content-Range', contentRange);
                headers.set('Accept-Ranges', 'bytes');
            }

            // Caching
            headers.set('Cache-Control', 'public, max-age=3600');
            
            // Security headers
            headers.set('X-Content-Type-Options', 'nosniff');

            return new NextResponse(response.body, {
                status: response.status,
                headers,
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                return NextResponse.json(
                    { error: 'Request timed out' },
                    { status: 504 }
                );
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('[backend-files] Error:', error);
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
            'Allow': 'GET, OPTIONS',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
        }
    });
}
