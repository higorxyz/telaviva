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

export type SearchItem = MediaSummary | (PersonSummary & { mediaType: 'person' });

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface EpisodeSummary {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  stillPath: string | null;
  runtime: number | null;
  voteAverage: number;
}

export interface SeasonDetails {
  seasonNumber: number;
  name: string;
  overview: string;
  episodes: EpisodeSummary[];
}

interface DetailsCommon extends MediaSummary {
  tagline: string;
  genres: Genre[];
  /** Classificação indicativa do Brasil (ex.: "16"), quando existir. */
  certification: string | null;
  trailer: Video | null;
  cast: CastMember[];
  providers: WatchProviders;
  recommendations: MediaSummary[];
}

export interface MovieDetails extends DetailsCommon {
  runtime: number | null;
  imdbId: string | null;
  /** USD; 0 when TMDb has no figure. */
  budget: number;
  revenue: number;
}

export interface TvDetails extends DetailsCommon {
  status: string;
  inProduction: boolean;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  seasons: SeasonSummary[];
  nextEpisodeToAir: EpisodeSummary | null;
  lastEpisodeToAir: EpisodeSummary | null;
  episodeRunTime: number | null;
}

export type PersonCredit = MediaSummary & { role: string; department: string };

export interface PersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownForDepartment: string | null;
  alsoKnownAs: string[];
  credits: PersonCredit[];
  images: string[];
}
