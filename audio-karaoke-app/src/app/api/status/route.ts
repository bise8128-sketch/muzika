import { NextResponse } from 'next/server';

const startTime = Date.now();

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        services: {
            modelRepository: 'connected' // Simplified for local dev
        },
        version: '0.1.0'
    });
}
