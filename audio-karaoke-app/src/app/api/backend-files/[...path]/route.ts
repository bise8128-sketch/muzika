import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8000';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string }> }
) {
    const { path } = await params;
    const url = `${BACKEND_URL}/files/${path}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
        headers.set('Content-Length', response.headers.get('Content-Length') || '');
        headers.set('Cache-Control', 'public, max-age=3600');

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error('Backend file error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
