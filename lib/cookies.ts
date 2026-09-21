import { headers } from 'next/headers'

// Decide the `Secure` cookie flag from the ACTUAL request protocol rather than
// NODE_ENV. This avoids a silent production footgun: with `secure: true` hard-
// wired in production, a browser drops the cookie over plain HTTP (any non-
// localhost address), so login "works" but the session never persists.
//
// Resolution order:
//   COOKIE_SECURE=true|false  → explicit override (use "true" for direct HTTPS
//                               with no proxy that sets x-forwarded-proto).
//   otherwise (auto)          → Secure only when the request arrived over HTTPS,
//                               detected via the x-forwarded-proto header that a
//                               TLS-terminating proxy/load balancer sets.
//
// Result: Secure cookies over HTTPS (the norm in production behind a proxy),
// working cookies over HTTP (local/LAN testing) — never a silent auth failure.
export async function cookieSecure(): Promise<boolean> {
  const override = process.env.COOKIE_SECURE
  if (override === 'true') return true
  if (override === 'false') return false
  try {
    const h = await headers()
    const proto = (h.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase()
    return proto === 'https'
  } catch {
    return false
  }
}
