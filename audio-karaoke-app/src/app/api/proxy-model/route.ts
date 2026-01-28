
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Security check: only allow GitHub release URLs
    if (!url.startsWith('https://github.com/') && !url.includes('githubusercontent.com')) {
        return NextResponse.json({ error: 'Invalid URL. Only GitHub URLs are allowed.' }, { status: 400 });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch model: ${response.statusText}` },
                { status: response.status }
            );
        }

        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Length', response.headers.get('Content-Length') || '');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
