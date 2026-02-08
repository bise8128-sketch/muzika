import { NextRequest, NextResponse } from 'next/server';
import { circuitBreakerFetch } from '@/utils/api/circuitBreakerFetch';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Use circuitBreakerFetch for robustness against backend failures
        const response = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            // If service returns valid JSON error (400, etc.), parse it
            try {
                const error = await response.json();
                return NextResponse.json(error, { status: response.status });
            } catch (e) {
                // If not JSON, return generic error
                return NextResponse.json({ error: response.statusText }, { status: response.status });
            }
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Backend download error:', error);

        // Handle Circuit Breaker specific errors if needed
        if (error instanceof Error && error.name === 'CircuitOpenError') {
            return NextResponse.json({ error: 'Service is currently unavailable due to high failure rate. Please try again later.' }, { status: 503 });
        }

        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Could not connect to backend server: ' + message }, { status: 503 });
    }
}
