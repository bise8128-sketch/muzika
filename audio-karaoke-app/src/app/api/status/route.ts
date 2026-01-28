import { NextResponse } from 'next/server';

const startTime = Date.now();

export async function GET() {
    let githubStatus = 'unknown';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch('https://github.com/TRvlvr/model_repo/releases/tag/all_public_uvr_models', {
            method: 'HEAD',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        githubStatus = response.ok ? 'connected' : `error: ${response.status}`;
    } catch (error) {
        githubStatus = `error: ${error instanceof Error ? error.message : String(error)}`;
    }

    return NextResponse.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        services: {
            modelRepository: githubStatus
        },
        version: '0.1.0'
    });
}
