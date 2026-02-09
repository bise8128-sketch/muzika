import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log(`[API] Proxying upload to Python service: ${file.name}`);

        const pythonFormData = new FormData();
        pythonFormData.append('file', file);

        const response = await fetch(`${PYTHON_SERVICE_URL}/api/upload`, {
            method: 'POST',
            body: pythonFormData,
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json({ error: error.detail || 'Upload to backend failed' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Backend upload proxy error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
    }
}
