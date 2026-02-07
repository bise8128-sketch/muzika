import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const PYTHON_CLI_PATH = path.resolve(process.cwd(), '../python-audio-cli/cli.py');
const VENV_PYTHON_PATH = path.resolve(process.cwd(), '../python-audio-cli/venv/bin/python');
const PROCESSED_DIR = path.join(process.cwd(), 'public/processed');

// Ensure processed directory exists
if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, model = 'htdemucs', format = 'mp3', separate = true } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const jobId = randomUUID();
        const jobDir = path.join(PROCESSED_DIR, jobId);

        // Create job directory
        fs.mkdirSync(jobDir, { recursive: true });

        // Initial status
        const statusPath = path.join(jobDir, 'status.json');
        fs.writeFileSync(statusPath, JSON.stringify({
            status: 'processing',
            jobId,
            url,
            startTime: Date.now()
        }));

        // Construct arguments
        // Note: The CLI takes --output, and puts downloads in output/downloads and stems in output/stems
        // We want the output to be in jobDir
        const args = [
            PYTHON_CLI_PATH,
            url,
            '--output', jobDir,
            '--format', format
        ];

        if (separate) {
            args.push('--separate');
        }

        console.log(`[Python] Spawning: ${VENV_PYTHON_PATH} ${args.join(' ')}`);

        // Spawn detached process
        const pythonProcess = spawn(VENV_PYTHON_PATH, args, {
            detached: true,
            stdio: 'ignore', // Ignore stdio to allow detachment
            cwd: path.dirname(PYTHON_CLI_PATH) // Run from the python-audio-cli directory context if needed, but absolute paths are better. 
            // Actually, the CLI imports `utils` from current directory. So we MUST set cwd to python-audio-cli root.
        });

        // We can't easily listen to events if we detach and unref. 
        // But if we want to update status.json, we need a wrapper script or keep it attached but respond to client.
        // In Next.js API routes, if we await the process, the request hangs.
        // If we don't await, Vercel/Next.js might kill the process when the response is sent (in serverless).
        // But in "next start" (Node server), it should persist.

        // BETTER APPROACH for reliability:
        // Use a wrapper script that runs the command and updates status.json on completion.
        // Or simple: Just let it run. The client polls. 
        // But how does the client know it finished? 
        // The process writes files.
        // BUT we need to update status.json to "completed" and list the files.

        // I'll write a tiny JS worker script to manage this background task.
        // Or just use a simple `child_process.exec` with a callback, but don't await it? 
        // Node.js event loop might keep running?

        // Let's try the simple approach: handle the process events.
        // Next.js (Node server) shouldn't kill background processes immediately.

        pythonProcess.unref(); // Allow the parent to exit independently if needed, but here we want the server to keep running.

        // Wait, if I unref(), I can't listen to 'close'.
        // If I keep it ref'd, does the API response block? No, API response is sent when `return` happens.
        // But will Next.js kill the request context?

        // Let's assume standard Node.js behavior.
        // I will NOT unref, but I will NOT await the promise of completion. I will just attach listeners.

        // Re-spawn with stdio pipe to capture errors
        const child = spawn(VENV_PYTHON_PATH, args, {
            cwd: path.dirname(PYTHON_CLI_PATH)
        });

        let logs = '';
        child.stdout.on('data', (data) => {
            logs += data.toString();
            // Optional: update status with progress if we parse logs
        });

        child.stderr.on('data', (data) => {
            logs += data.toString();
        });

        child.on('close', (code) => {
            console.log(`[Job ${jobId}] content processing finished with code ${code}`);

            // Scan for results
            let result: Record<string, any> = {};
            if (code === 0) {
                try {
                    // Check stems directory
                    const stemsDir = path.join(jobDir, 'stems');
                    const downloadsDir = path.join(jobDir, 'downloads');

                    let stems: Record<string, string> = {};
                    let original = null;

                    if (fs.existsSync(stemsDir)) {
                        // The structure is stems/<track_name>/<instrument>.wav
                        // We need to find the track name directory
                        const trackDirs = fs.readdirSync(stemsDir).filter(d => fs.statSync(path.join(stemsDir, d)).isDirectory());
                        if (trackDirs.length > 0) {
                            const trackName = trackDirs[0]; // Assume one track per job
                            const trackPath = path.join(stemsDir, trackName);
                            const files = fs.readdirSync(trackPath);
                            files.forEach(f => {
                                stems[f.replace('.wav', '')] = `/processed/${jobId}/stems/${trackName}/${f}`;
                            });
                        }
                    }

                    if (fs.existsSync(downloadsDir)) {
                        const files = fs.readdirSync(downloadsDir);
                        if (files.length > 0) {
                            original = `/processed/${jobId}/downloads/${files[0]}`;
                        }
                    }

                    result = {
                        status: 'completed',
                        stems,
                        original,
                        logs
                    };
                } catch (e) {
                    result = {
                        status: 'error',
                        error: 'Failed to parse results',
                        logs
                    };
                }
            } else {
                result = {
                    status: 'error',
                    error: `Process exited with code ${code}`,
                    logs
                };
            }

            fs.writeFileSync(statusPath, JSON.stringify({ ...result, jobId, url, endTime: Date.now() }));
        });

        return NextResponse.json({ jobId, status: 'processing' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const statusPath = path.join(PROCESSED_DIR, jobId, 'status.json');

    if (!fs.existsSync(statusPath)) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    try {
        const statusData = fs.readFileSync(statusPath, 'utf-8');
        return NextResponse.json(JSON.parse(statusData));
    } catch (e) {
        return NextResponse.json({ error: 'Failed to read job status' }, { status: 500 });
    }
}
