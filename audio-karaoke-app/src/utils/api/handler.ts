
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export function createHandler<T>(
    schema: z.ZodSchema<T>,
    handler: (data: T, req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest) => {
        try {
            const body = await req.json();
            const result = schema.safeParse(body);

            if (!result.success) {
                return NextResponse.json({
                    error: 'Validation failed',
                    details: result.error.errors
                }, { status: 400 });
            }

            return await handler(result.data, req);
        } catch (error) {
            console.error('API Error:', error);
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
    };
}
