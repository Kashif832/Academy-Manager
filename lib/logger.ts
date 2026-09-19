// Structured JSON application logger with sensitive-data redaction.
//
// Every log line is a single JSON object (easy to ship to a log aggregator).
// Values under sensitive keys are redacted so passwords, hashes, tokens,
// secrets and cookies can never leak into logs — even if a caller accidentally
// passes them in a context object.

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|hash|apikey|api_key|session/i

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1)
    }
    return out
  }
  return value
}

type Level = 'debug' | 'info' | 'warn' | 'error'

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  })
  // eslint-disable-next-line no-console
  ;(level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line)
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) => emit('debug', m, c),
  info: (m: string, c?: Record<string, unknown>) => emit('info', m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit('warn', m, c),
  error: (m: string, c?: Record<string, unknown>) => emit('error', m, c),
}
