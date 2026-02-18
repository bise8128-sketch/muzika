import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { buildCSP } from '@/utils/security/sanitize';

const intlMiddleware = createMiddleware(routing);

/**
 * Allowed origins for CORS
 * In production, configure these via environment variables
 */
const getAllowedOrigins = (): string[] => {
  const origins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean) as string[];
  
  // Add any additional origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }
  
  return origins;
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  // Check exact match
  if (allowedOrigins.includes(origin)) return true;
  
  // Check for Vercel preview deployments (if configured)
  if (process.env.ALLOW_VERCEL_PREVIEWS === 'true') {
    try {
      const url = new URL(origin);
      if (url.hostname.endsWith('.vercel.app')) return true;
    } catch {
      // Invalid URL
    }
  }
  
  return false;
}

export default function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle API routes and static files separately (skip intl)
    if (pathname.startsWith('/api') || pathname.match(/\.(png|jpg|jpeg|svg|css|js|mjs|wasm|ico|json|map|mp3|wav)$/)) {
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
    const allowedOrigins = getAllowedOrigins();
    const origin = request.headers.get('origin');
    
    // Basic security headers
    const securityHeaders: Record<string, string> = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    };

    // Add Content-Security-Policy for non-API routes
    if (!request.nextUrl.pathname.startsWith('/api/')) {
        securityHeaders['Content-Security-Policy'] = buildCSP({
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Required for Next.js inline scripts
                "'unsafe-eval'", // Required for WASM modules
                'blob:', // Required for web workers
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Required for Tailwind CSS
            ],
            imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https:', // Allow images from HTTPS sources
            ],
            mediaSrc: [
                "'self'",
                'blob:',
                'data:',
            ],
            connectSrc: [
                "'self'",
                ...(process.env.PYTHON_SERVICE_URL ? [new URL(process.env.PYTHON_SERVICE_URL).origin] : []),
                ...(process.env.MODEL_REPOSITORY_URL ? [new URL(process.env.MODEL_REPOSITORY_URL).origin] : []),
            ],
            fontSrc: ["'self'", 'data:'],
            workerSrc: ["'self'", 'blob:'],
            frameSrc: ["'none'"],
        });
    }

    // Apply basic headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });

    // CORS for API routes - with origin validation
    if (request.nextUrl.pathname.startsWith('/api/')) {
        if (isOriginAllowed(origin, allowedOrigins)) {
            // Reflect the allowed origin back
            response.headers.set('Access-Control-Allow-Origin', origin!);
            response.headers.set('Access-Control-Allow-Credentials', 'true');
        } else if (process.env.NODE_ENV === 'development' && origin) {
            // In development, be more permissive but log warnings
            console.warn(`[CORS] Unrecognized origin in development: ${origin}`);
            response.headers.set('Access-Control-Allow-Origin', origin);
        }
        // If origin is not allowed, don't set Access-Control-Allow-Origin
        // This will cause the browser to block the request
        
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, X-Requested-With');
        response.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
        response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
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
