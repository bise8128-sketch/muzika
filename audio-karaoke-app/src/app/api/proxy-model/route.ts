
import { NextRequest, NextResponse } from 'next/server';
import { translate } from '../../../utils/translations';
import { z } from 'zod';

const querySchema = z.object({
    url: z.string().url(),
});

const ALLOWED_DOMAINS = [
    'github.com',
    'githubusercontent.com',
    'huggingface.co',
    'cdn-lfs.huggingface.co',
    'objects.githubusercontent.com',
];

/** Timeout for each fetch attempt (ms) */
const FETCH_TIMEOUT_MS = 60_000;

/** Max retry attempts for transient network failures */
const MAX_RETRIES = 2;

/** Delay between retries (ms) */
const RETRY_DELAY_MS = 1_000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            redirect: 'follow',
        });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

function isRetryable(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') return true;
    if (error instanceof TypeError) return true; // Network failures
    const msg = error instanceof Error ? error.message : '';
    return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed/i.test(msg);
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const urlParam = searchParams.get('url');

    const result = querySchema.safeParse({ url: urlParam });
    if (!result.success) {
        return NextResponse.json({ error: translate('Invalid or missing url parameter') }, { status: 400 });
    }

    const { url } = result.data;

    try {
        const parsedUrl = new URL(url);
        if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.endsWith(domain))) {
            return NextResponse.json({ error: translate('Invalid URL. Domain not allowed.') }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: translate('Invalid URL format') }, { status: 400 });
    }

    // Pass through range headers if present to support resumed downloads
    const range = request.headers.get('range');
    const fetchOptions: RequestInit = {
        headers: {
            'User-Agent': 'Muzika-Audio-App',
            ...(range ? { 'Range': range } : {}),
        },
    };

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                console.log(`[proxy-model] Retry attempt ${attempt} for: ${url}`);
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            }

            const response = await fetchWithTimeout(url, fetchOptions, FETCH_TIMEOUT_MS);

            if (!response.ok && response.status !== 206) {
                return NextResponse.json(
                    { error: `Failed to fetch model: ${response.status} ${response.statusText}` },
                    { status: response.status }
                );
            }

            const headers = new Headers();
            const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
            const contentLength = response.headers.get('Content-Length');
            const contentRange = response.headers.get('Content-Range');

            headers.set('Content-Type', contentType);
            if (contentLength) headers.set('Content-Length', contentLength);
            if (contentRange) headers.set('Content-Range', contentRange);

            headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
            headers.set('Accept-Ranges', 'bytes');

            return new NextResponse(response.body, {
                status: response.status,
                headers,
            });
        } catch (error) {
            lastError = error;
            console.error(`[proxy-model] Attempt ${attempt + 1}/${MAX_RETRIES} failed for ${url}:`, error);

            if (!isRetryable(error) || attempt === MAX_RETRIES - 1) {
                break;
            }
        }
    }

    // Build a descriptive error message for the client
    const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
    const isTimeout = lastError instanceof DOMException && lastError.name === 'AbortError';
    const detail = isTimeout
        ? `Connection timed out after ${FETCH_TIMEOUT_MS / 1000}s. The model server may be unreachable.`
        : `Network error: ${errMsg}`;

    console.error('[proxy-model] All attempts failed:', detail);

    return NextResponse.json(
        { error: detail },
        { status: 502 }
    );
}
