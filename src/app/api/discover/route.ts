import { NextResponse } from 'next/server';
import { parsePageParam } from '@/lib/page-param';
import { filtersToSearchParams, parseFilters, toTmdbParams } from '@/features/discover/filters';
import { discover } from '@/features/tmdb/discover';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const parsed = parsePageParam(params);
  if ('error' in parsed) return parsed.error;
  const { page } = parsed;

  const filters = parseFilters(params);
  try {
    return NextResponse.json(await discover(filters.media, toTmdbParams(filters), page));
  } catch (error) {
    console.error(`[api/discover] failed for "${filtersToSearchParams(filters)}" page ${page}`, error);
    return NextResponse.json({ error: 'Não foi possível carregar os resultados agora.' }, { status: 502 });
  }
}
