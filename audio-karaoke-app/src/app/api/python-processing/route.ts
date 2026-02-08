import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';

/**
 * Python Processing API (Refactored)
 * 
 * This endpoint delegates audio separation (vocal/instrumental) to the Python microservice.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

interface PythonError {
    detail?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { filename, model = 'htdemucs' } = body;

        if (!filename) {
            return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
        }

        console.log(`[API] Forwarding separation request to Python service for: ${filename}`);

        // Set a long timeout for separation (can take minutes depending on track length and hardware)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

        try {
            const response = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/separate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, model }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as PythonError;
                console.error('[API] Python separation error:', errorData);
                return NextResponse.json(
                    { error: errorData.detail || 'Separation failed' },
                    { status: response.status }
                );
            }

            const data = await response.json();

            // The Python service returns relative paths for stems
            // Map these to our backend proxy URLs
            const stems: Record<string, string> = {};
            if (data.stems) {
                Object.entries(data.stems as Record<string, string>).forEach(([key, value]) => {
                    stems[key] = `/api/backend-files/${value}`;
                });
            }

            return NextResponse.json({
                status: 'completed',
                stems,
                jobId: data.jobId || 'legacy',
                source: 'python-service'
            });

        } catch (fetchError: unknown) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error) {
                if (fetchError.name === 'AbortError') {
                    return NextResponse.json({ error: 'Separation process timed out' }, { status: 504 });
                }
                if (fetchError.name === 'CircuitOpenError') {
                    return NextResponse.json({ error: 'Service is currently unavailable (Circuit Breaker Open)' }, { status: 503 });
                }
            }
            throw fetchError;
        }

    } catch (error: unknown) {
        console.error('Python processing error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Failed to connect to audio separation service: ${message}` },
            { status: 503 }
        );
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'ready', message: 'Use POST to start processing' });
}
