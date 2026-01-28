
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
    'cdn-lfs.huggingface.co'
];

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
    } catch (e) {
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

    try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok && response.status !== 206) {
            return NextResponse.json(
                { error: translate('Failed to fetch model: %s', response.statusText) },
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
        console.error('Proxy error:', error);
        return NextResponse.json({ error: translate('Internal server error') }, { status: 500 });
    }
}
