import { NextRequest, NextResponse } from 'next/server'

// Nonce-based Content-Security-Policy (Next 16 `proxy.ts`, formerly middleware).
//
// script-src uses a per-request nonce + 'strict-dynamic' and drops
// 'unsafe-inline'/'unsafe-eval' in production — the meaningful XSS hardening.
// Next.js auto-applies the nonce to its framework/page scripts.
//
// style-src intentionally keeps 'unsafe-inline': React inline style ATTRIBUTES
// (style={{…}}) and Tailwind cannot carry a nonce, and CSP nonces don't apply
// to attributes. Style-injection is far lower risk than script injection; this
// is the standard, documented compromise.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // Run on pages, not on API routes or static assets, and skip prefetches.
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
