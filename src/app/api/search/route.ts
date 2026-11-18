import { NextResponse } from 'next/server';
import { normalizeQuery } from '@/features/search/query';
import { searchMulti } from '@/features/tmdb/search';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const rawPage = params.get('page') ?? '1';
  const page = Number(rawPage);
  if (!/^\d+$/.test(rawPage) || page < 1 || page > 500) {
    return NextResponse.json({ error: 'Página inválida (use um inteiro de 1 a 500).' }, { status: 400 });
  }

  const query = normalizeQuery(params.get('q'));
  if (!query) return NextResponse.json({ page: 1, totalPages: 0, totalResults: 0, results: [] });

  try {
    return NextResponse.json(await searchMulti(query, page));
  } catch (error) {
    console.error(`[api/search] failed for page ${page}`, error);
    return NextResponse.json({ error: 'Não foi possível buscar agora.' }, { status: 502 });
  }
}
