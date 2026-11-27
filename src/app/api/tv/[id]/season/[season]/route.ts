import { NextResponse } from 'next/server';
import { loadSeason } from '@/features/detail/load-season';

const parseInteger = (raw: string, min: number): number | null =>
  /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) >= min ? Number(raw) : null;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; season: string }> },
) {
  const raw = await params;
  const id = parseInteger(raw.id, 1);
  const season = parseInteger(raw.season, 0);
  if (id === null || season === null) {
    return NextResponse.json({ error: 'Série ou temporada inválida.' }, { status: 400 });
  }

  const result = await loadSeason(id, season);
  if (result.status === 'ok') return NextResponse.json(result.season);
  if (result.status === 'missing') {
    return NextResponse.json({ error: 'Temporada não encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Não foi possível carregar a temporada agora.' }, { status: 502 });
}
