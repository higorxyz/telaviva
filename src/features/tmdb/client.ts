import 'server-only';
import type { z } from 'zod';
import { env } from '@/lib/env';

/** Upper bound for one TMDb request, so a hung upstream never stalls a render. */
export const TIMEOUT_MS = 8000;

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

export async function tmdbFetch<S extends z.ZodType>(
  path: string,
  params: TmdbParams,
  schema: S,
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), {
      headers: { Authorization: `Bearer ${env.TMDB_READ_TOKEN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    // DOMException is not always an Error subclass, so check the name structurally.
    const name = typeof cause === 'object' && cause !== null && 'name' in cause ? String(cause.name) : '';
    const timedOut = name === 'TimeoutError' || name === 'AbortError';
    const reason = timedOut ? 'tempo esgotado' : cause instanceof Error ? cause.message : 'falha de rede';
    throw new TmdbError(`Falha ao chamar o TMDb (${path}): ${reason}`, 0, path);
  }
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
