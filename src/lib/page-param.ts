import { NextResponse } from 'next/server';

export const MAX_PAGE = 500;

/** Reads `?page=` (default 1) as an integer 1..500; anything else yields a ready 400 response. */
export function parsePageParam(params: URLSearchParams): { page: number } | { error: NextResponse } {
  const raw = params.get('page') ?? '1';
  const page = Number(raw);
  if (!/^\d+$/.test(raw) || page < 1 || page > MAX_PAGE) {
    return { error: NextResponse.json({ error: 'Página inválida (use um inteiro de 1 a 500).' }, { status: 400 }) };
  }
  return { page };
}
