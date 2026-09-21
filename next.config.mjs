/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. The Content-Security-
// Policy is set per-request in proxy.ts (nonce-based) — NOT here — so it is
// deliberately omitted below to avoid two CSP headers (browsers intersect them).
// A fallback CSP is applied only to /api responses, which never execute scripts.
const apiCsp = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS: only meaningful over HTTPS; harmless over HTTP (browsers ignore it there).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  // Emit a self-contained server bundle for a small production Docker image.
  output: 'standalone',
  // X-Powered-By leaks the framework; drop it.
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [{ key: 'Content-Security-Policy', value: apiCsp }] },
    ]
  },
}

export default nextConfig
