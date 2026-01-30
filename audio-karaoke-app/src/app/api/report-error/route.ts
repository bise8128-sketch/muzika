
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHandler } from '@/utils/api/handler';

const errorSchema = z.object({
    message: z.string(),
    stack: z.string().optional(),
    component: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = createHandler(errorSchema, async (data, request) => {
    // In a real app, you might save this to a database or send to a logging service like Sentry
    console.error('[CLIENT_ERROR_REPORT]:', {
        ...data,
        timestamp: new Date().toISOString(),
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({ status: 'ok' });
});
