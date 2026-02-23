import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const handleI18nRouting = createIntlMiddleware(routing);

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  
  // Construct CSP with nonce
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' blob: https://unpkg.com https://cdn.logr-in.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com;
    media-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self' ws: wss: https://github.com https://githubusercontent.com https://huggingface.co https://unpkg.com https://*.logrocket.io https://*.logrocket.com https://*.ld-7.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    worker-src 'self' blob:;
  `.replace(/\s{2,}/g, ' ').trim()
 
  // Let next-intl handle the routing first
  const response = handleI18nRouting(request);
  
  // Set CSP and Nonce headers on the request for Server Components
  request.headers.set('x-nonce', nonce)
  request.headers.set('Content-Security-Policy', cspHeader)
  
  // Also pass the nonce in the response header for client-side injection
  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy', cspHeader)
 
  return response
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // However, match all root locales
    '/',
    '/(bs|en)/:path*'
  ]
};
