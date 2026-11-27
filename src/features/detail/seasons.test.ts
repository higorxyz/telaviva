import { describe, expect, it } from 'vitest';
import type { EpisodeSummary, SeasonSummary, TvDetails } from '@/features/tmdb/types';
import { defaultSeason, isAired, orderSeasons, parseSeasonParam, statusLabel } from './seasons';

const s = (seasonNumber: number, episodeCount = 8, airDate: string | null = '2020-01-01'): SeasonSummary => ({
  seasonNumber,
  name: `Season ${seasonNumber}`,
  episodeCount,
  airDate,
  posterPath: null,
});
const tv = (over: Partial<TvDetails>) => ({ seasons: [], lastEpisodeToAir: null, ...over }) as TvDetails;
const ep = (seasonNumber: number) => ({ seasonNumber, episodeNumber: 1 }) as EpisodeSummary;

describe('orderSeasons', () => {
  it('regulares em ordem crescente e depois a temporada 0 como Especiais', () => {
    const out = orderSeasons([s(0), s(2), s(1)]);
    expect(out.map((x) => x.seasonNumber)).toEqual([1, 2, 0]);
    expect(out[2]!.name).toBe('Especiais');
  });
  it('mantém só a temporada 0 e aceita lista vazia', () => {
    expect(orderSeasons([s(0)]).map((x) => x.seasonNumber)).toEqual([0]);
    expect(orderSeasons([])).toEqual([]);
  });
  it('remove temporadas sem episódios e sem data', () => {
    expect(orderSeasons([s(1), s(2, 0, null), s(3, 0, '2030-01-01')]).map((x) => x.seasonNumber)).toEqual([1, 3]);
  });
});

describe('defaultSeason', () => {
  it('usa a temporada do último episódio exibido', () => {
    expect(defaultSeason(tv({ seasons: [s(1), s(2), s(3)], lastEpisodeToAir: ep(2) }))).toBe(2);
  });
  it('cai para a primeira regular, depois para os especiais, depois null', () => {
    expect(defaultSeason(tv({ seasons: [s(0), s(2), s(1)] }))).toBe(1);
    expect(defaultSeason(tv({ seasons: [s(0)] }))).toBe(0);
    expect(defaultSeason(tv({ seasons: [], lastEpisodeToAir: null }))).toBeNull();
  });
  it('ignora um último episódio de temporada que não está na lista', () => {
    expect(defaultSeason(tv({ seasons: [s(1)], lastEpisodeToAir: ep(5) }))).toBe(1);
  });
});

describe('parseSeasonParam', () => {
  const ordered = orderSeasons([s(1), s(2), s(0)]);
  it('aceita só números presentes na lista', () => {
    expect(parseSeasonParam('2', ordered)).toBe(2);
    expect(parseSeasonParam('0', ordered)).toBe(0);
    expect(parseSeasonParam('9', ordered)).toBeNull();
    expect(parseSeasonParam('abc', ordered)).toBeNull();
    expect(parseSeasonParam('1.5', ordered)).toBeNull();
    expect(parseSeasonParam(['2', '1'], ordered)).toBeNull();
    expect(parseSeasonParam(undefined, ordered)).toBeNull();
  });
});

describe('statusLabel', () => {
  it('traduz os status do TMDb e mantém o valor desconhecido', () => {
    expect(statusLabel('Returning Series')).toBe('Em exibição');
    expect(statusLabel('Ended')).toBe('Finalizada');
    expect(statusLabel('Canceled')).toBe('Cancelada');
    expect(statusLabel('In Production')).toBe('Em produção');
    expect(statusLabel('Planned')).toBe('Planejada');
    expect(statusLabel('Pilot')).toBe('Piloto');
    expect(statusLabel('Weird')).toBe('Weird');
  });
});

describe('isAired', () => {
  it('exibido quando a data é hoje ou antes; futuro e sem data não contam', () => {
    expect(isAired('2026-11-17', '2026-11-18')).toBe(true);
    expect(isAired('2026-11-18', '2026-11-18')).toBe(true);
    expect(isAired('2026-11-19', '2026-11-18')).toBe(false);
    expect(isAired(null, '2026-11-18')).toBe(false);
  });
});
