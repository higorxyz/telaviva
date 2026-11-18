import { NextResponse } from 'next/server';
import { isCatalogListId } from '@/features/catalog/list-ids';
import { CATALOG_LISTS } from '@/features/catalog/lists';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const list = params.get('list') ?? '';
  if (!isCatalogListId(list)) {
    return NextResponse.json({ error: 'Lista inválida.' }, { status: 400 });
  }

  const rawPage = params.get('page') ?? '1';
  const page = Number(rawPage);
  if (!/^\d+$/.test(rawPage) || page < 1 || page > 500) {
    return NextResponse.json({ error: 'Página inválida (use um inteiro de 1 a 500).' }, { status: 400 });
  }

  try {
    return NextResponse.json(await CATALOG_LISTS[list].fetch(page));
  } catch (error) {
    console.error(`[api/catalog] failed for ${list} page ${page}`, error);
    return NextResponse.json({ error: 'Não foi possível carregar a lista agora.' }, { status: 502 });
  }
}
