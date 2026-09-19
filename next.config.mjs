/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. A strict nonce-based CSP
// would require request-time nonces (Next 16 `proxy.ts`); that is tracked as a
// follow-up. The policy below still removes the biggest footguns: it forbids
// framing (clickjacking), object/embed, and cross-origin form posts, and pins
// base-uri. script-src keeps 'unsafe-inline'/'unsafe-eval' because the app has
// no nonce pipeline yet — documented honestly rather than claimed as strict.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS: only meaningful over HTTPS; harmless over HTTP (browsers ignore it there).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  // X-Powered-By leaks the framework; drop it.
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
