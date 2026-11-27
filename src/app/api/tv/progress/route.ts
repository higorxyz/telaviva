import { NextResponse } from 'next/server';
import { toProgressInfo, type TvProgressInfo } from '@/features/library/progress';
import { isTmdbNotFound } from '@/features/tmdb/client';
import { getTvProgressSource } from '@/features/tmdb/tv';
import { limitByIp } from '@/lib/api-guard';

const MAX_IDS = 40;

function parseIds(raw: string): number[] | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const ids = [...new Set(parts.map(Number))];
  if (ids.length === 0 || ids.length > MAX_IDS || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    return null;
  }
  return ids;
}

export async function GET(request: Request) {
  const limited = limitByIp(request);
  if (limited) return limited;
  const ids = parseIds(new URL(request.url).searchParams.get('ids') ?? '');
  if (!ids) {
    return NextResponse.json({ error: `Informe de 1 a ${MAX_IDS} ids numéricos.` }, { status: 400 });
  }

  const settled = await Promise.allSettled(ids.map((id) => getTvProgressSource(id)));
  const result: Record<string, TvProgressInfo> = {};
  let failures = 0;
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      result[String(ids[i])] = toProgressInfo(outcome.value);
    } else if (!isTmdbNotFound(outcome.reason)) {
      failures += 1;
      console.error(`[api/tv/progress] failed for tv ${ids[i]}`, outcome.reason);
    }
  });

  if (failures === ids.length) {
    return NextResponse.json({ error: 'Não foi possível carregar o progresso agora.' }, { status: 502 });
  }
  return NextResponse.json(result);
}
