import { NextResponse } from 'next/server';

/**
 * Guards for the API routes that fan out to TMDb (/api/recommendations and /api/tv/progress).
 *
 * The rate limiter is best-effort: it lives in the memory of one server instance, so each instance (and each cold
 * start) counts on its own. It only caps a burst from one client against one instance; a platform firewall rule is
 * the real protection. It keys on the first `x-forwarded-for` hop, which the hosting platform sets (and overwrites)
 * on every request; a request without that header (local dev, the E2E server) is not limited.
 */

export const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

type Check = { ok: true } | { ok: false; retryAfterSeconds: number };

export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { count: number; resetAt: number }>();

  function makeRoom(now: number) {
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
    // Still full: drop the oldest windows (Map keeps insertion order) rather than grow without bound.
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    check(key: string, now = Date.now()): Check {
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        windows.delete(key);
        if (windows.size >= maxKeys) makeRoom(now);
        entry = { count: 0, resetAt: now + opts.windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      if (entry.count <= opts.limit) return { ok: true };
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    },
    size: () => windows.size,
  };
}

/** One budget for both TMDb fan-out routes: 30 requests per minute per IP, per instance. */
export const apiRateLimiter = createRateLimiter({ limit: RATE_LIMIT, windowMs: RATE_WINDOW_MS });

export function clientIp(request: Request): string | null {
  const first = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first || null;
}

/** A 429 (with Retry-After) when the caller's IP is over its budget; null when the request may go on. */
export function limitByIp(request: Request, limiter = apiRateLimiter): NextResponse | null {
  const ip = clientIp(request);
  if (!ip) return null;
  const result = limiter.check(ip);
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Muitas requisições. Tente de novo em instantes.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}

type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

/**
 * Reads a JSON body of at most `maxBytes`: a larger content-length is refused before reading, and the stream is
 * cut off as soon as it goes past the cap (the header can be missing or lie).
 */
export async function readJsonBody(request: Request, maxBytes = MAX_BODY_BYTES): Promise<BodyResult> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400 };
  }
}
