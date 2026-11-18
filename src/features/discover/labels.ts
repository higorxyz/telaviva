import type { Genre, MediaType, Provider } from '@/features/tmdb/types';
import type { DiscoverSort } from './filters';

export interface DiscoverCatalog {
  genres: Record<MediaType, Genre[]>;
  providers: Record<MediaType, Provider[]>;
}

export const LANGUAGES = [
  { code: '', label: 'Todos' },
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'Inglês' },
  { code: 'es', label: 'Espanhol' },
  { code: 'fr', label: 'Francês' },
  { code: 'ja', label: 'Japonês' },
  { code: 'ko', label: 'Coreano' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Alemão' },
] as const;

export const VOTE_OPTIONS = [0, 100, 500, 1000, 5000] as const;

export const SORT_LABELS: Record<DiscoverSort, string> = {
  popularidade: 'Popularidade',
  nota: 'Nota',
  lancamento: 'Lançamento',
  bilheteria: 'Bilheteria',
  titulo: 'Título (A–Z)',
};

export const formatDecimal = (n: number) => n.toFixed(1).replace('.', ',');
export const formatVotes = (n: number) => n.toLocaleString('pt-BR');
export const languageLabel = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;
