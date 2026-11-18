import { NextResponse } from 'next/server';
import { filtersToSearchParams, parseFilters, toTmdbParams } from '@/features/discover/filters';
import { discover } from '@/features/tmdb/discover';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const rawPage = params.get('page') ?? '1';
  const page = Number(rawPage);
  if (!/^\d+$/.test(rawPage) || page < 1 || page > 500) {
    return NextResponse.json({ error: 'Página inválida (use um inteiro de 1 a 500).' }, { status: 400 });
  }

  const filters = parseFilters(params);
  try {
    return NextResponse.json(await discover(filters.media, toTmdbParams(filters), page));
  } catch (error) {
    console.error(`[api/discover] failed for "${filtersToSearchParams(filters)}" page ${page}`, error);
    return NextResponse.json({ error: 'Não foi possível carregar os resultados agora.' }, { status: 502 });
  }
}
