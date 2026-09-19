import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

// Correlation / request ID: reuse an inbound `x-request-id` (e.g. from a proxy)
// or mint one. Included in error responses and logs so a user-reported error
// can be traced to its server log line.
export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || randomUUID()
}

// Consistent, safe error contract. Never leaks stack traces, SQL/Prisma
// internals or secrets — only a caller-safe message plus the request id.
export function jsonError(status: number, message: string, requestId?: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, ...(requestId ? { requestId } : {}), ...(extra ?? {}) },
    { status, headers: requestId ? { 'x-request-id': requestId } : undefined },
  )
}

// Wrap a route handler so any UNEXPECTED throw becomes a redacted, correlated
// 500 instead of a raw stack trace. Expected errors should still be returned
// explicitly with jsonError(...) for correct status codes.
export function withErrorContract(
  handler: (request: NextRequest, ctx: { requestId: string; params?: unknown }) => Promise<NextResponse>,
) {
  return async (request: NextRequest, routeCtx?: { params?: unknown }) => {
    const requestId = getRequestId(request)
    try {
      return await handler(request, { requestId, params: routeCtx?.params })
    } catch (err) {
      logger.error('unhandled_route_error', {
        requestId,
        method: request.method,
        path: request.nextUrl?.pathname,
        // Message only — never the stack — and redacted by the logger.
        err: err instanceof Error ? err.message : String(err),
      })
      return jsonError(500, 'An unexpected error occurred. Please try again.', requestId)
    }
  }
}
