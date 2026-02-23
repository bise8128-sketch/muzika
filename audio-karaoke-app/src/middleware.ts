import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
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
 
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set(
    'Content-Security-Policy',
    cspHeader
  )
 
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set(
    'Content-Security-Policy',
    cspHeader
  )
 
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
