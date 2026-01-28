
import { NextRequest, NextResponse } from 'next/server';
import { translate } from '../../../utils/translations';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: translate('Missing url parameter') }, { status: 400 });
    }

    // Security check: only allow GitHub release URLs
    if (!url.startsWith('https://github.com/') && !url.includes('githubusercontent.com')) {
        return NextResponse.json({ error: translate('Invalid URL. Only GitHub URLs are allowed.') }, { status: 400 });
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return NextResponse.json(
                { error: translate('Failed to fetch model: %s', response.statusText) },
                { status: response.status }
            );
        }

        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
        headers.set('Content-Length', response.headers.get('Content-Length') || '');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: translate('Internal server error') }, { status: 500 });
    }
}
