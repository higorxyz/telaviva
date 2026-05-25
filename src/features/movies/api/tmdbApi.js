import { normalizeMovieList, mergeMovieData } from '../utils/movieAdapter';
import { trackError } from '../../../lib/telemetry/logger';

const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.REACT_APP_TMDB_API_KEY;
const DEFAULT_LANGUAGE = 'pt-BR';
const DEFAULT_REGION = 'BR';
const PROVIDER_CATEGORIES = ['flatrate', 'free', 'ads', 'rent', 'buy'];

export const DISCOVER_SORT_BY_OPTIONS = [
  'popularity.desc',
  'popularity.asc',
  'release_date.desc',
  'release_date.asc',
  'vote_average.desc',
  'vote_average.asc',
  'vote_count.desc',
  'vote_count.asc',
  'revenue.desc',
  'revenue.asc',
  'primary_release_date.desc',
  'primary_release_date.asc',
  'title.asc',
  'title.desc',
  'original_title.asc',
  'original_title.desc',
];

const DISCOVER_SORT_BY_SET = new Set(DISCOVER_SORT_BY_OPTIONS);

const createDateWithOffset = (dayOffset = 0) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const parseReleaseDate = (releaseDate) => {
  if (!releaseDate || typeof releaseDate !== 'string') {
    return null;
  }

  const parsedDate = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const sortMoviesByReleaseDate = (movies, direction = 'desc') => {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...movies].sort((firstMovie, secondMovie) => {
    const firstDate = parseReleaseDate(firstMovie.release_date);
    const secondDate = parseReleaseDate(secondMovie.release_date);

    if (!firstDate && !secondDate) {
      return 0;
    }
    if (!firstDate) {
      return 1;
    }
    if (!secondDate) {
      return -1;
    }

    return (firstDate.getTime() - secondDate.getTime()) * multiplier;
  });
};

const sortMoviesByWeightedRating = (movies, minimumVotes = 1500, globalMeanRating = 6.8) => {
  const calculateScore = (movie) => {
    const rating = Number(movie.vote_average ?? 0);
    const votes = Number(movie.vote_count ?? 0);

    if (!Number.isFinite(rating) || !Number.isFinite(votes) || votes <= 0) {
      return 0;
    }

    return ((votes / (votes + minimumVotes)) * rating) +
      ((minimumVotes / (votes + minimumVotes)) * globalMeanRating);
  };

  return [...movies].sort((firstMovie, secondMovie) => {
    const firstScore = calculateScore(firstMovie);
    const secondScore = calculateScore(secondMovie);

    if (secondScore !== firstScore) {
      return secondScore - firstScore;
    }

    const firstVotes = Number(firstMovie.vote_count ?? 0);
    const secondVotes = Number(secondMovie.vote_count ?? 0);
    if (secondVotes !== firstVotes) {
      return secondVotes - firstVotes;
    }

    const firstRating = Number(firstMovie.vote_average ?? 0);
    const secondRating = Number(secondMovie.vote_average ?? 0);
    return secondRating - firstRating;
  });
};

const applyMoviePrecisionRules = (movies, rules = {}) =>
  movies.filter((movie) => {
    const voteAverage = Number(movie.vote_average ?? 0);
    const voteCount = Number(movie.vote_count ?? 0);

    if (Number.isFinite(rules.minVoteAverage) && voteAverage < rules.minVoteAverage) {
      return false;
    }

    if (Number.isFinite(rules.minVoteCount) && voteCount < rules.minVoteCount) {
      return false;
    }

    if (rules.requirePoster && !movie.poster_path && !movie.backdrop_path) {
      return false;
    }

    if (Number.isFinite(rules.minOverviewLength)) {
      const overview = typeof movie.overview === 'string' ? movie.overview.trim() : '';
      if (overview.length < rules.minOverviewLength) {
        return false;
      }
    }

    const releaseDate = parseReleaseDate(movie.release_date);
    if (rules.minReleaseDate && (!releaseDate || releaseDate < rules.minReleaseDate)) {
      return false;
    }

    if (rules.maxReleaseDate && (!releaseDate || releaseDate > rules.maxReleaseDate)) {
      return false;
    }

    return true;
  });

const mapAndRefinePaginatedMovies = (data, rules = {}) => {
  const mappedMovies = mapPaginatedMovies(data);
  const refinedMovies = applyMoviePrecisionRules(mappedMovies.results, rules);

  const minimumSizeBeforeFallback = Number.isFinite(rules.minResultsBeforeFallback)
    ? rules.minResultsBeforeFallback
    : 8;

  const baseResults =
    refinedMovies.length >= minimumSizeBeforeFallback ? refinedMovies : [...mappedMovies.results];

  const sortedResults = rules.sortByReleaseDate
    ? sortMoviesByReleaseDate(baseResults, rules.sortByReleaseDate)
    : baseResults;

  return {
    ...mappedMovies,
    results: sortedResults,
  };
};

const ensureApiKey = () => {
  if (!API_KEY) {
    const error = new Error('Chave da API TMDb não configurada. Defina REACT_APP_TMDB_API_KEY.');
    error.code = 'TMDB_API_KEY_MISSING';
    throw error;
  }
};

const buildUrl = (path, params = {}) => {
  const url = new URL(`${API_BASE_URL}/${path}`);
  url.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    const normalizedValue = typeof value === 'string' ? value : String(value);
    url.searchParams.set(key, normalizedValue);
  });
  if (!url.searchParams.has('language')) {
    url.searchParams.set('language', DEFAULT_LANGUAGE);
  }
  return url.toString();
};

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeRegionCode = (regionCode, fallback = 'BR') => {
  if (!regionCode || typeof regionCode !== 'string') {
    return fallback;
  }

  const normalized = regionCode.trim().toUpperCase();
  return normalized.length === 2 ? normalized : fallback;
};

const normalizeDiscoverFilters = (filters = {}) => {
  const genreIds = Array.isArray(filters.genreIds)
    ? filters.genreIds
        .map((genreId) => String(genreId).trim())
        .filter(Boolean)
    : [];

  const singleGenreId = typeof filters.genreId === 'string' ? filters.genreId.trim() : filters.genreId;
  if (singleGenreId) {
    genreIds.push(String(singleGenreId));
  }

  const year = toNumberOrUndefined(filters.year ?? filters.primaryReleaseYear);
  const minVoteAverage = toNumberOrUndefined(filters.minVoteAverage);
  const minVoteCount = toNumberOrUndefined(filters.minVoteCount);
  const runtimeGte = toNumberOrUndefined(filters.runtimeGte);
  const runtimeLte = toNumberOrUndefined(filters.runtimeLte);

  const requestedSortBy =
    typeof filters.sortBy === 'string' && DISCOVER_SORT_BY_SET.has(filters.sortBy)
      ? filters.sortBy
      : 'popularity.desc';

  const includeAdult = Boolean(filters.includeAdult);
  const watchRegion = normalizeRegionCode(filters.watchRegion, 'BR');
  const watchProviderIds = Array.isArray(filters.watchProviderIds)
    ? filters.watchProviderIds
        .map((providerId) => String(providerId).trim())
        .filter(Boolean)
        .join('|')
    : undefined;

  const originalLanguage =
    typeof filters.originalLanguage === 'string' && filters.originalLanguage.trim().length > 0
      ? filters.originalLanguage.trim().toLowerCase()
      : undefined;

  return {
    with_genres: genreIds.length > 0 ? genreIds.join(',') : undefined,
    primary_release_year: year,
    'vote_average.gte': minVoteAverage,
    'vote_count.gte': minVoteCount,
    sort_by: requestedSortBy,
    include_adult: includeAdult,
    watch_region: watchProviderIds ? watchRegion : undefined,
    with_watch_providers: watchProviderIds,
    'with_runtime.gte': runtimeGte,
    'with_runtime.lte': runtimeLte,
    with_original_language: originalLanguage,
  };
};

const fetchFromTmdb = async (path, context, params = {}) => {
  try {
    ensureApiKey();
    const response = await fetch(buildUrl(path, params));
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload.status_message || `Erro ao ${context}`);
      error.status = response.status;
      error.context = context;
      throw error;
    }
    return response.json();
  } catch (error) {
    if (error.name === 'TypeError') {
      const networkError = new Error(`Falha de conexão ao ${context}`);
      networkError.cause = error;
      trackError(networkError, { path, params });
      throw networkError;
    }
    trackError(error, { path, params });
    throw error;
  }
};

const mapPaginatedMovies = (data) => ({
  page: data.page ?? 1,
  totalPages: data.total_pages ?? 1,
  totalResults: data.total_results ?? data.results?.length ?? 0,
  results: normalizeMovieList(data.results ?? []),
});

export const fetchPopularMovies = async (page = 1) => {
  const today = toIsoDate(createDateWithOffset(0));

  const data = await fetchFromTmdb('discover/movie', 'buscar filmes populares', {
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
    'vote_count.gte': 250,
    'vote_average.gte': 5.8,
    'primary_release_date.lte': today,
  });

  return mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minOverviewLength: 30,
    minResultsBeforeFallback: 10,
  });
};

export const fetchTopRatedMovies = async (page = 1) => {
  const today = toIsoDate(createDateWithOffset(0));

  const data = await fetchFromTmdb('discover/movie', 'buscar filmes mais avaliados', {
    page,
    sort_by: 'vote_average.desc',
    include_adult: false,
    'vote_count.gte': 1200,
    'vote_average.gte': 7.2,
    'primary_release_date.lte': today,
  });

  const mappedTopRatedMovies = mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minOverviewLength: 30,
    minVoteAverage: 7.2,
    minVoteCount: 1200,
    minResultsBeforeFallback: 0,
  });

  return {
    ...mappedTopRatedMovies,
    results: sortMoviesByWeightedRating(mappedTopRatedMovies.results),
  };
};

export const fetchNowPlayingMovies = async (page = 1) => {
  const minDate = createDateWithOffset(-120);
  const maxDate = createDateWithOffset(14);

  const data = await fetchFromTmdb('movie/now_playing', 'buscar filmes em cartaz', {
    page,
    region: DEFAULT_REGION,
  });

  return mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minVoteAverage: 5,
    minVoteCount: 40,
    minReleaseDate: minDate,
    maxReleaseDate: maxDate,
    sortByReleaseDate: 'desc',
    minResultsBeforeFallback: 0,
  });
};

export const fetchUpcomingMovies = async (page = 1) => {
  const minDate = createDateWithOffset(1);
  const maxDate = createDateWithOffset(450);

  const data = await fetchFromTmdb('discover/movie', 'buscar próximos lançamentos', {
    page,
    region: DEFAULT_REGION,
    include_adult: false,
    sort_by: 'release_date.asc',
    'release_date.gte': toIsoDate(minDate),
    'release_date.lte': toIsoDate(maxDate),
    with_release_type: '2|3',
  });

  return mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minResultsBeforeFallback: 0,
  });
};

export const fetchTrendingMovies = async (timeWindow = 'week', page = 1) => {
  const normalizedTimeWindow = timeWindow === 'day' ? 'day' : 'week';
  const data = await fetchFromTmdb(
    `trending/movie/${normalizedTimeWindow}`,
    'buscar filmes em tendência',
    { page }
  );

  return mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minVoteCount: 30,
    minResultsBeforeFallback: 10,
  });
};

const fetchCuratedDiscoverMovies = async (context, params = {}, rules = {}) => {
  const data = await fetchFromTmdb('discover/movie', context, params);

  return mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minOverviewLength: 20,
    minResultsBeforeFallback: 8,
    ...rules,
  });
};

export const fetchTrendingNowMovies = async (page = 1) => fetchTrendingMovies('day', page);

export const fetchHiddenGemMovies = async (page = 1) => {
  const today = toIsoDate(createDateWithOffset(0));

  return fetchCuratedDiscoverMovies('buscar joias escondidas', {
    page,
    include_adult: false,
    sort_by: 'vote_average.desc',
    'vote_average.gte': 7.2,
    'vote_count.gte': 120,
    'vote_count.lte': 1200,
    'primary_release_date.lte': today,
  }, {
    minVoteAverage: 7,
    minVoteCount: 120,
    minResultsBeforeFallback: 6,
  });
};

export const fetchShortRuntimeMovies = async (page = 1) => {
  const today = toIsoDate(createDateWithOffset(0));

  return fetchCuratedDiscoverMovies('buscar filmes curtos', {
    page,
    include_adult: false,
    sort_by: 'popularity.desc',
    'with_runtime.lte': 100,
    'vote_count.gte': 100,
    'vote_average.gte': 6,
    'primary_release_date.lte': today,
  }, {
    minVoteAverage: 6,
    minVoteCount: 100,
    minResultsBeforeFallback: 8,
  });
};

export const fetchBlockbusterMovies = async (page = 1) => {
  const today = toIsoDate(createDateWithOffset(0));

  return fetchCuratedDiscoverMovies('buscar blockbusters de bilheteria', {
    page,
    include_adult: false,
    sort_by: 'revenue.desc',
    'vote_count.gte': 1000,
    'vote_average.gte': 6,
    'primary_release_date.lte': today,
  }, {
    minVoteAverage: 6,
    minVoteCount: 1000,
    minOverviewLength: 12,
    minResultsBeforeFallback: 8,
  });
};

export const fetchStreamingMovies = async (page = 1, regionCode = DEFAULT_REGION) => {
  const today = toIsoDate(createDateWithOffset(0));
  const region = normalizeRegionCode(regionCode, DEFAULT_REGION);

  return fetchCuratedDiscoverMovies('buscar filmes em streaming por região', {
    page,
    include_adult: false,
    sort_by: 'popularity.desc',
    watch_region: region,
    with_watch_monetization_types: 'flatrate',
    'vote_count.gte': 80,
    'primary_release_date.lte': today,
  }, {
    minVoteCount: 80,
    minResultsBeforeFallback: 8,
  });
};

export const fetchMovieDetails = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}`, 'buscar detalhes do filme', {
    append_to_response: 'translations,release_dates',
  });
  const translation = data.translations?.translations?.find(
    (item) => item.iso_639_1 === 'pt' && item.data?.title
  );
  if (translation?.data?.title) {
    data.title = translation.data.title;
  }
  return mergeMovieData(data, data);
};

export const fetchMoviesByCategory = async (categoryId, page = 1) => {
  const today = toIsoDate(createDateWithOffset(0));

  const strictFilters = {
    with_genres: categoryId,
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
    'vote_count.gte': 40,
    'vote_average.gte': 5,
    'primary_release_date.lte': today,
  };

  const data = await fetchFromTmdb('discover/movie', 'buscar filmes por categoria', strictFilters);

  if ((data.results?.length ?? 0) === 0 && page === 1) {
    const fallbackData = await fetchFromTmdb('discover/movie', 'buscar filmes por categoria', {
      with_genres: categoryId,
      page,
      sort_by: 'popularity.desc',
      include_adult: false,
      'primary_release_date.lte': today,
    });

    return mapAndRefinePaginatedMovies(fallbackData, {
      requirePoster: true,
      minOverviewLength: 12,
      minResultsBeforeFallback: 1,
    });
  }

  return mapAndRefinePaginatedMovies(data, {
    requirePoster: true,
    minOverviewLength: 20,
    minResultsBeforeFallback: 8,
  });
};

export const fetchMovieTrailer = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}/videos`, 'buscar trailer do filme');
  const videos = Array.isArray(data.results) ? data.results : [];

  if (videos.length === 0) {
    return null;
  }

  const sortedVideos = [...videos].sort((a, b) => {
    const scoreVideo = (video) => {
      let score = 0;

      if (video.site === 'YouTube') {
        score += 50;
      }

      if (video.type === 'Trailer') {
        score += 30;
      }

      if (video.official) {
        score += 15;
      }

      if (video.iso_639_1 === 'pt') {
        score += 10;
      }

      return score;
    };

    return scoreVideo(b) - scoreVideo(a);
  });

  return sortedVideos[0] ?? null;
};

export const fetchCategories = async () => {
  const data = await fetchFromTmdb('genre/movie/list', 'buscar categorias');
  return data.genres ?? [];
};

export const fetchMovieProviders = async (regionCode = DEFAULT_REGION) => {
  const region = normalizeRegionCode(regionCode, DEFAULT_REGION);
  const data = await fetchFromTmdb('watch/providers/movie', 'buscar provedores de filmes', {
    watch_region: region,
  });

  const rawProviders = Array.isArray(data.results) ? data.results : [];
  const dedupedProviders = new Map();

  rawProviders.forEach((provider) => {
    if (!provider || provider.provider_id == null) {
      return;
    }

    if (!dedupedProviders.has(provider.provider_id)) {
      dedupedProviders.set(provider.provider_id, provider);
    }
  });

  return Array.from(dedupedProviders.values()).sort((a, b) => {
    const firstPriority = Number.isFinite(a.display_priority) ? a.display_priority : 999;
    const secondPriority = Number.isFinite(b.display_priority) ? b.display_priority : 999;
    return firstPriority - secondPriority;
  });
};

export const fetchMovieCast = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}/credits`, 'buscar elenco do filme');
  return data.cast ?? [];
};

export const fetchPersonDetails = async (personId) => {
  return fetchFromTmdb(`person/${personId}`, 'buscar perfil da pessoa');
};

export const fetchPersonMovieCredits = async (personId) => {
  const data = await fetchFromTmdb(`person/${personId}/movie_credits`, 'buscar créditos da pessoa');

  return {
    cast: normalizeMovieList(data.cast ?? []),
    crew: normalizeMovieList(data.crew ?? []),
  };
};

export const fetchPersonImages = async (personId) => {
  const data = await fetchFromTmdb(`person/${personId}/images`, 'buscar imagens da pessoa', {
    include_image_language: 'pt-BR,null',
  });

  return Array.isArray(data.profiles) ? data.profiles : [];
};

export const fetchMoviesBySearch = async (query, page = 1, options = {}) => {
  const sanitizedQuery = query?.trim();
  if (!sanitizedQuery) {
    return mapPaginatedMovies({ results: [], page: 1, total_pages: 1, total_results: 0 });
  }

  const includeAdult = Boolean(options.includeAdult);
  const year = toNumberOrUndefined(options.year);
  const primaryReleaseYear = toNumberOrUndefined(options.primaryReleaseYear);
  const region =
    typeof options.region === 'string' && options.region.trim().length > 0
      ? normalizeRegionCode(options.region, DEFAULT_REGION)
      : undefined;
  const customLanguage =
    typeof options.language === 'string' && options.language.trim().length > 0
      ? options.language.trim()
      : undefined;

  const data = await fetchFromTmdb('search/movie', 'buscar filmes', {
    query: sanitizedQuery,
    page,
    include_adult: includeAdult,
    year,
    primary_release_year: primaryReleaseYear,
    region,
    language: customLanguage,
  });
  return mapPaginatedMovies(data);
};

export const fetchDiscoverMovies = async (filters = {}, page = 1) => {
  const normalizedFilters = normalizeDiscoverFilters(filters);
  const data = await fetchFromTmdb('discover/movie', 'buscar filmes com filtros avançados', {
    ...normalizedFilters,
    page,
  });

  const mappedDiscoverMovies = mapPaginatedMovies(data);

  if (normalizedFilters.sort_by === 'vote_average.desc') {
    return {
      ...mappedDiscoverMovies,
      results: sortMoviesByWeightedRating(mappedDiscoverMovies.results),
    };
  }

  return mappedDiscoverMovies;
};

export const fetchSimilarMovies = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}/similar`, 'buscar filmes similares', {
    page: 1,
  });
  return normalizeMovieList(data.results ?? []);
};

export const fetchMovieRecommendations = async (movieId) => {
  const data = await fetchFromTmdb(
    `movie/${movieId}/recommendations`,
    'buscar recomendações do filme',
    {
      page: 1,
    }
  );

  return normalizeMovieList(data.results ?? []);
};

export const fetchMovieWatchProviders = async (movieId, regionCode = 'BR') => {
  const data = await fetchFromTmdb(
    `movie/${movieId}/watch/providers`,
    'buscar provedores de streaming do filme'
  );

  const region = normalizeRegionCode(regionCode, 'BR');
  const byRegion = data?.results?.[region] ?? data?.results?.BR;

  if (!byRegion) {
    return {
      region,
      link: null,
      providers: {
        flatrate: [],
        free: [],
        ads: [],
        rent: [],
        buy: [],
      },
    };
  }

  const dedupeProviders = (providerList = []) => {
    const providersMap = new Map();

    providerList.forEach((provider) => {
      if (!provider || provider.provider_id == null) {
        return;
      }
      if (!providersMap.has(provider.provider_id)) {
        providersMap.set(provider.provider_id, provider);
      }
    });

    return Array.from(providersMap.values());
  };

  const providers = PROVIDER_CATEGORIES.reduce((acc, category) => {
    acc[category] = dedupeProviders(byRegion[category] ?? []);
    return acc;
  }, {});

  return {
    region,
    link: byRegion.link ?? null,
    providers,
  };
};

/**
 * @param {Array} movies
 * @returns {Promise<Array>} 
 */
export const fetchRecommendedMovies = async (movies) => {
  try {
    if (!movies || movies.length === 0) {
      return [];
    }

    const sortedMovies = [...movies]
      .filter(movie => movie.vote_average && movie.vote_average > 0)
      .sort((a, b) => {
        const scoreA = (a.vote_average || 0) * 0.7 + (a.popularity || 0) * 0.3;
        const scoreB = (b.vote_average || 0) * 0.7 + (b.popularity || 0) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, 8);

    const recommendationPromises = sortedMovies.flatMap(movie => [
      fetchSimilarMovies(movie.id).catch(() => []),
      fetchFromTmdb(`movie/${movie.id}/recommendations`, 'buscar recomendações', { page: 1 })
        .then(data => normalizeMovieList(data.results ?? []))
        .catch(() => [])
    ]);

    const results = await Promise.allSettled(recommendationPromises);

    const allRecommendations = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .flatMap(result => result.value);

    const userGenres = new Map();
    sortedMovies.forEach(movie => {
      if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
        movie.genre_ids.forEach(genreId => {
          userGenres.set(genreId, (userGenres.get(genreId) || 0) + 1);
        });
      }
    });

    const movieScores = new Map();
    const watchedIds = new Set(movies.map(m => m.id));

    allRecommendations.forEach(movie => {

      if (watchedIds.has(movie.id)) {
        return;
      }

      if (!movieScores.has(movie.id)) {
        let score = 0;

        const frequency = allRecommendations.filter(m => m.id === movie.id).length;
        score += Math.min(frequency * 5, 40);

        if (movie.genre_ids && Array.isArray(movie.genre_ids)) {
          const genreScore = movie.genre_ids.reduce((sum, genreId) => {
            return sum + (userGenres.get(genreId) || 0) * 3;
          }, 0);
          score += Math.min(genreScore, 30);
        }

        if (movie.vote_average && movie.vote_average > 0) {
          score += (movie.vote_average / 10) * 20;
        }

        if (movie.popularity && movie.popularity > 0) {
          score += Math.min((movie.popularity / 100) * 10, 10);
        }

        movieScores.set(movie.id, { movie, score });
      }
    });

    const recommendedMovies = Array.from(movieScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(item => item.movie);

    if (recommendedMovies.length < 10) {
      const popularData = await fetchPopularMovies(1);
      const additionalMovies = popularData.results
        .filter(movie => !watchedIds.has(movie.id) && !movieScores.has(movie.id))
        .slice(0, 10 - recommendedMovies.length);

      recommendedMovies.push(...additionalMovies);
    }

    return recommendedMovies;

  } catch (error) {
    console.error('Erro ao buscar filmes recomendados:', error);
    trackError(error, { context: 'fetchRecommendedMovies' });

    try {
      const popularData = await fetchPopularMovies(1);
      return popularData.results.slice(0, 20);
    } catch (fallbackError) {
      return [];
    }
  }
};

export const fetchMoviesFromLocalStorage = () => {
  try {
    const rawWatched = localStorage.getItem('watchedMovies');
    const rawToWatch = localStorage.getItem('toWatchMovies');
    const watchedMovies = normalizeMovieList(rawWatched ? JSON.parse(rawWatched) : []);
    const toWatchMovies = normalizeMovieList(rawToWatch ? JSON.parse(rawToWatch) : []);
    return { watchedMovies, toWatchMovies };
  } catch (error) {
    console.error('Erro ao acessar o localStorage:', error);
    return { watchedMovies: [], toWatchMovies: [] };
  }
};
