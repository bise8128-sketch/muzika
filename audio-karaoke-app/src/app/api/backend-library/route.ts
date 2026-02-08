import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export async function GET() {
    try {
        const response = await fetch(`${PYTHON_SERVICE_URL}/api/library`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch library from backend' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Backend library error:', error);
        return NextResponse.json({ error: 'Could not connect to backend server' }, { status: 503 });
    }
}
