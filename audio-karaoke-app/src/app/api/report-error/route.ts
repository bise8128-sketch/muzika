
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // In a real app, you might save this to a database or send to a logging service like Sentry
        console.error('[CLIENT_ERROR_REPORT]:', {
            ...body,
            timestamp: new Date().toISOString(),
            ip: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
        });

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
