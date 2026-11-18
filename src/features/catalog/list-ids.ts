import type { MediaType } from '@/features/tmdb/types';

/** Client-safe catalog list metadata (no server code). Fetchers live in lists.ts. */
export interface CatalogListMeta {
  title: { lead: string; accent?: string };
  description: string;
  media: MediaType;
}

export const CATALOG_LIST_META = {
  'filmes/em-alta': {
    title: { lead: 'Filmes', accent: 'em alta' },
    description: 'Os filmes que todo mundo está vendo esta semana.',
    media: 'movie',
  },
  'filmes/em-cartaz': {
    title: { lead: 'Filmes', accent: 'em cartaz' },
    description: 'Nos cinemas do Brasil agora.',
    media: 'movie',
  },
  'filmes/populares': {
    title: { lead: 'Filmes', accent: 'populares' },
    description: 'Os mais populares do momento.',
    media: 'movie',
  },
  'filmes/mais-bem-avaliados': {
    title: { lead: 'Filmes mais', accent: 'bem avaliados' },
    description: 'Os favoritos do público de todos os tempos.',
    media: 'movie',
  },
  'filmes/em-breve': {
    title: { lead: 'Filmes', accent: 'em breve' },
    description: 'Lançamentos que chegam aos cinemas nos próximos meses.',
    media: 'movie',
  },
  'filmes/joias-escondidas': {
    title: { lead: 'Joias', accent: 'escondidas' },
    description: 'Filmes excelentes que pouca gente viu.',
    media: 'movie',
  },
  'filmes/curtos': {
    title: { lead: 'Filmes', accent: 'curtos' },
    description: 'Boas histórias em até 100 minutos.',
    media: 'movie',
  },
  'filmes/blockbusters': {
    title: { lead: 'Grandes', accent: 'bilheterias' },
    description: 'Os filmes que mais arrecadaram.',
    media: 'movie',
  },
  'filmes/no-streaming': {
    title: { lead: 'Filmes no', accent: 'streaming' },
    description: 'Disponíveis nos serviços de streaming no Brasil.',
    media: 'movie',
  },
  'series/em-alta': {
    title: { lead: 'Séries', accent: 'em alta' },
    description: 'As séries mais comentadas da semana.',
    media: 'tv',
  },
  'series/no-ar-hoje': {
    title: { lead: 'Séries no ar', accent: 'hoje' },
    description: 'Episódios que vão ao ar hoje.',
    media: 'tv',
  },
  'series/em-exibicao': {
    title: { lead: 'Séries', accent: 'em exibição' },
    description: 'Séries com episódios novos chegando.',
    media: 'tv',
  },
  'series/populares': {
    title: { lead: 'Séries', accent: 'populares' },
    description: 'As séries mais populares do momento.',
    media: 'tv',
  },
  'series/mais-bem-avaliadas': {
    title: { lead: 'Séries mais', accent: 'bem avaliadas' },
    description: 'As séries favoritas do público.',
    media: 'tv',
  },
} as const satisfies Record<string, CatalogListMeta>;

export type CatalogListId = keyof typeof CATALOG_LIST_META;

export function isCatalogListId(v: string): v is CatalogListId {
  return Object.hasOwn(CATALOG_LIST_META, v);
}
