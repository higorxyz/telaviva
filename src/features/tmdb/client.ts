import 'server-only';
import type { z } from 'zod';
import { env } from '@/lib/env';

export type TmdbParams = Record<string, string | number | boolean | undefined | null>;

/** `status` is the HTTP status, or 0 when the request never got a response (network failure). */
export class TmdbError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
    this.path = path;
  }
}

export function isTmdbNotFound(e: unknown): boolean {
  return e instanceof TmdbError && e.status === 404;
}

function buildUrl(path: string, params: TmdbParams): URL {
  const url = new URL(`${env.TMDB_API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`);
  url.searchParams.set('language', 'pt-BR');
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'status_message' in body) {
      const message = body.status_message;
      if (typeof message === 'string' && message) return message;
    }
  } catch {
    // body was not JSON
  }
  return `TMDb respondeu ${res.status}`;
}

/** Waits before retrying a 429: Retry-After (seconds or HTTP date, capped), else this attempt's backoff. */
const RETRY_BACKOFF_MS = [300, 900];
const MAX_RETRY_AFTER_MS = 2000;

export function retryDelay(res: Response, attempt: number): number {
  const header = res.headers.get('retry-after')?.trim();
  if (header) {
    const seconds = Number(header);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now();
    if (Number.isFinite(ms)) return Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS);
  }
  return RETRY_BACKOFF_MS[attempt]!;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function send(url: URL, path: string, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${env.TMDB_READ_TOKEN}`, Accept: 'application/json' },
      // Upper bound per call (default 8 s, shared by its retries), so a hung TMDb never stalls a render.
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    // DOMException is not always an Error subclass, so check the name structurally.
    const name = typeof cause === 'object' && cause !== null && 'name' in cause ? String(cause.name) : '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    const reason = timedOut ? 'tempo esgotado' : cause instanceof Error ? cause.message : 'falha de rede';
    throw new TmdbError(`Falha ao chamar o TMDb (${path}): ${reason}`, 0, path);
  }
}

/**
 * Sends the request, retrying a 429 (rate limit) at most RETRY_BACKOFF_MS.length times while the call's time
 * budget (TMDB_TIMEOUT_MS) allows the wait; every other status is final.
 */
async function sendWithRetry(url: URL, path: string): Promise<Response> {
  const deadline = Date.now() + env.TMDB_TIMEOUT_MS;
  let res = await send(url, path, env.TMDB_TIMEOUT_MS);
  for (let attempt = 0; res.status === 429 && attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    const wait = retryDelay(res, attempt);
    if (Date.now() + wait >= deadline) break;
    await res.body?.cancel();
    await sleep(wait);
    res = await send(url, path, deadline - Date.now());
  }
  return res;
}

export async function tmdbFetch<S extends z.ZodType>(
  path: string,
  params: TmdbParams,
  schema: S,
): Promise<z.infer<S>> {
  const res = await sendWithRetry(buildUrl(path, params), path);
  if (!res.ok) throw new TmdbError(await errorMessage(res), res.status, path);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new TmdbError(`Resposta não JSON do TMDb em ${path}`, res.status, path);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`Resposta inesperada do TMDb em ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}
