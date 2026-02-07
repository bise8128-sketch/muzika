import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';
import { Readable } from 'stream';

type YtdlSourceStream = Readable;

/**
 * LEGAL DISCLAIMER & TERMS OF SERVICE WARNING
 * ============================================
 * 
 * IMPORTANT: This YouTube audio extraction feature may violate YouTube's Terms of Service.
 * 
 * YouTube's Terms of Service (Section 4.B) prohibit:
 * - Downloading content unless a download button or link is provided by YouTube
 * - Accessing or using the YouTube API services in unauthorized ways
 * 
 * PRODUCTION DEPLOYMENT REQUIREMENTS:
 * 1. Add a visible legal disclaimer in your UI informing users of YouTube TOS
 * 2. Implement user authentication to track usage and prevent abuse
 * 3. Add rate limiting to prevent excessive API calls
 * 4. Consider using YouTube's official Data API v3 for authorized access
 * 5. Consult with legal counsel before deploying to production
 * 6. Obtain proper licenses for any commercial use
 * 
 * ALTERNATIVES TO CONSIDER:
 * - YouTube Data API v3 (official API with quotas and restrictions)
 * - Direct user file upload only
 * - Integration with licensed music streaming services
 * - User-owned content only with verification
 * 
 * By using this code, you acknowledge these risks and take full responsibility
 * for ensuring compliance with applicable laws and terms of service.
 */

// YouTube URL validation
function isValidYouTubeUrl(url: string): boolean {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
        /^(https?:\/\/)?youtu\.be\/.+$/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=.+$/,
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Extract YouTube video ID from URL
function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

export async function POST(request: NextRequest) {
    console.log('[API] /api/extract-youtube called');
    try {
        const body = await request.json();
        const { url } = body;
        console.log('[API] Processing URL:', url);

        // Validate YouTube URL
        if (!url || typeof url !== 'string') {
            console.warn('[API] Invalid URL provided');
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        if (!isValidYouTubeUrl(url)) {
            return NextResponse.json(
                { error: 'Invalid YouTube URL format' },
                { status: 400 }
            );
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            return NextResponse.json(
                { error: 'Could not extract video ID from URL' },
                { status: 400 }
            );
        }

        // Check if ytdl-core is available
        if (!ytdl) {
            return NextResponse.json(
                {
                    error: 'YouTube extraction service is not configured. Please install @distube/ytdl-core',
                    requiresSetup: true
                },
                { status: 501 }
            );
        }

        // Configure ytdl agent
        // using cookies from env or default agent to avoid 403 errors
        const cookies = process.env.YOUTUBE_COOKIES ? JSON.parse(process.env.YOUTUBE_COOKIES) : undefined;
        const agent = ytdl.createAgent(cookies);

        // Get video info with timeout and retries
        console.log('[API] Fetching video info...');
        const infoPromise = ytdl.getInfo(url, {
            agent,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                }
            }
        });

        // Add timeout to getInfo
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('YouTube info extraction timed out')), 15000)
        );

        const info = await Promise.race([infoPromise, timeoutPromise]);

        console.log('[API] Video info fetched:', info.videoDetails.title);
        const title = info.videoDetails.title;
        const duration = parseInt(info.videoDetails.lengthSeconds);
        const thumbnail = info.videoDetails.thumbnails[0]?.url || '';

        // Get best audio format
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        if (audioFormats.length === 0) {
            return NextResponse.json(
                { error: 'No audio available for this video' },
                { status: 404 }
            );
        }

        // Stream audio with highest quality
        const audioStream = ytdl(url, {
            quality: 'highestaudio',
            filter: 'audioonly',
            agent, // Use the same agent for the stream
            highWaterMark: 1 << 25, // Increase buffer size for stability
            dlChunkSize: 0, // Disable chunking to prevent connection drops
        });

        // Handle stream errors to prevent crashing
        audioStream.on('error', (error) => {
            console.error('YTDL stream error:', error);
        });

        // Convert Node.js Readable stream to Web ReadableStream
        const webStream = Readable.toWeb(audioStream as unknown as YtdlSourceStream);

        // Return streaming response with metadata in headers
        return new NextResponse(webStream as ReadableStream, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(title)}.mp3"`,
                'X-Video-Title': encodeURIComponent(title),
                'X-Video-Duration': duration.toString(),
                'X-Video-Thumbnail': thumbnail,
                'X-Legal-Warning': 'This content may be subject to YouTube Terms of Service',
            },
        });

    } catch (error: unknown) {
        console.error('YouTube extraction error:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        // Handle specific ytdl errors
        if (errorMessage.includes('Video unavailable')) {
            return NextResponse.json(
                { error: 'This video is private, unavailable, or has been removed' },
                { status: 404 }
            );
        }

        if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process YouTube URL. Please try again.' },
            { status: 500 }
        );
    }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

