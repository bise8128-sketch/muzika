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
        const { url, filename, model = 'htdemucs', format = 'mp3' } = body;

        // Check if we have either a URL (for YouTube download) or a filename (for direct processing)
        if (!url && !filename) {
            return NextResponse.json({ error: 'Either URL or filename is required' }, { status: 400 });
        }

        // If we have a URL, first download the file to get the filename
        let fileToProcess = filename;
        if (url) {
            console.log(`[API] Downloading from URL: ${url}`);

            try {
                const downloadResponse = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, format })
                });

                if (!downloadResponse.ok) {
                    const errorData = await downloadResponse.json().catch(() => ({ error: 'Download failed' }));
                    console.error('[API] Python download error:', errorData);
                    return NextResponse.json(
                        { error: errorData.detail || errorData.error || 'Download failed' },
                        { status: downloadResponse.status }
                    );
                }

                const downloadData = await downloadResponse.json();
                fileToProcess = downloadData.filename;
                console.log(`[API] Downloaded file: ${fileToProcess}`);
            } catch (downloadError) {
                console.error('Download error:', downloadError);
                return NextResponse.json(
                    { error: 'Failed to download audio from URL' },
                    { status: 500 }
                );
            }
        }

        if (!fileToProcess) {
            return NextResponse.json({ error: 'No file available for processing' }, { status: 400 });
        }

        console.log(`[API] Starting separation for: ${fileToProcess} with model: ${model}`);

        // Set a long timeout for separation (can take minutes depending on track length and hardware)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

        try {
            const response = await circuitBreakerFetch(`${PYTHON_SERVICE_URL}/api/separate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: fileToProcess, model }),
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
                source: 'python-service',
                filename: fileToProcess
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
