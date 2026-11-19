import { NextResponse } from 'next/server';
import { parsePageParam } from '@/lib/page-param';
import { isCatalogListId } from '@/features/catalog/list-ids';
import { CATALOG_LISTS } from '@/features/catalog/lists';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const list = params.get('list') ?? '';
  if (!isCatalogListId(list)) {
    return NextResponse.json({ error: 'Lista inválida.' }, { status: 400 });
  }

  const parsed = parsePageParam(params);
  if ('error' in parsed) return parsed.error;
  const { page } = parsed;

  try {
    return NextResponse.json(await CATALOG_LISTS[list].fetch(page));
  } catch (error) {
    console.error(`[api/catalog] failed for ${list} page ${page}`, error);
    return NextResponse.json({ error: 'Não foi possível carregar a lista agora.' }, { status: 502 });
  }
}
