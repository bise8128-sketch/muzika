import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle API routes and static files separately (skip intl)
    if (pathname.startsWith('/api') || pathname.match(/\.(png|jpg|jpeg|svg|css|js|ico|json)$/)) {
        const response = NextResponse.next();
        addSecurityHeaders(response, request);
        return response;
    }

    // Handle internationalized routes
    const response = intlMiddleware(request);
    addSecurityHeaders(response, request);
    return response;
}

function addSecurityHeaders(response: NextResponse, request: NextRequest) {
    const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    };

    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    // CORS for API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
        response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    }
}

export const config = {
    matcher: [
        // Match all pathnames except for
        // - … if they start with `/api`, `/_next` or `/_vercel`
        // - … the ones containing a dot (e.g. `favicon.ico`)
        // BUT we want to match /api for headers, so we adjust.
        // Actually, we want to run middleware on everything to apply headers, 
        // but conditionally run intlMiddleware.

        '/((?!_next/static|_next/image|favicon.ico).*)',
    ]
};
