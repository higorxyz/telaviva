export type MediaType = 'movie' | 'tv';

export interface MediaSummary {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  /** Filme: release_date; série: first_air_date. */
  releaseDate: string | null;
  genreIds: number[];
  originalLanguage: string;
}

export interface PersonSummary {
  id: number;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
}

export interface Paginated<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface Video {
  key: string;
  site: string;
  type: string;
  official: boolean;
  language: string;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface Provider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface WatchProviders {
  link: string | null;
  flatrate: Provider[];
  free: Provider[];
  ads: Provider[];
  rent: Provider[];
  buy: Provider[];
}
