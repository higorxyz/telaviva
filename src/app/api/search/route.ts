import { NextResponse } from 'next/server';
import { parsePageParam } from '@/lib/page-param';
import { normalizeQuery } from '@/features/search/query';
import { searchMulti } from '@/features/tmdb/search';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const parsed = parsePageParam(params);
  if ('error' in parsed) return parsed.error;
  const { page } = parsed;

  const query = normalizeQuery(params.get('q'));
  if (!query) return NextResponse.json({ page: 1, totalPages: 0, totalResults: 0, results: [] });

  try {
    return NextResponse.json(await searchMulti(query, page));
  } catch (error) {
    console.error(`[api/search] failed for page ${page}`, error);
    return NextResponse.json({ error: 'Não foi possível buscar agora.' }, { status: 502 });
  }
}
