import { normalizeMovieList, mergeMovieData } from '../utils/movieAdapter';
import { trackError } from '../../../lib/telemetry/logger';

const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.REACT_APP_TMDB_API_KEY;

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
    url.searchParams.set('language', 'pt-BR');
  }
  return url.toString();
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
      trackError(error, { path, params });
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
  const data = await fetchFromTmdb('movie/popular', 'buscar filmes populares', { page });
  return mapPaginatedMovies(data);
};

export const fetchTopRatedMovies = async (page = 1) => {
  const data = await fetchFromTmdb('movie/top_rated', 'buscar filmes mais avaliados', { page });
  return mapPaginatedMovies(data);
};

export const fetchNowPlayingMovies = async (page = 1) => {
  const data = await fetchFromTmdb('movie/now_playing', 'buscar filmes em cartaz', { page });
  return mapPaginatedMovies(data);
};

export const fetchUpcomingMovies = async (page = 1) => {
  const data = await fetchFromTmdb('movie/upcoming', 'buscar próximos lançamentos', { page });
  return mapPaginatedMovies(data);
};

export const fetchMovieDetails = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}`, 'buscar detalhes do filme', {
    append_to_response: 'translations',
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
  const data = await fetchFromTmdb('discover/movie', 'buscar filmes por categoria', {
    with_genres: categoryId,
    page,
  });
  return mapPaginatedMovies(data);
};

export const fetchMovieTrailer = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}/videos`, 'buscar trailer do filme');
  return data.results?.[0] ?? null;
};

export const fetchCategories = async () => {
  const data = await fetchFromTmdb('genre/movie/list', 'buscar categorias');
  return data.genres ?? [];
};

export const fetchMovieCast = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}/credits`, 'buscar elenco do filme');
  return data.cast ?? [];
};

export const fetchMoviesBySearch = async (query, page = 1) => {
  const sanitizedQuery = query?.trim();
  if (!sanitizedQuery) {
    return mapPaginatedMovies({ results: [], page: 1, total_pages: 1, total_results: 0 });
  }
  const data = await fetchFromTmdb('search/movie', 'buscar filmes', {
    query: sanitizedQuery,
    page,
    include_adult: false,
  });
  return mapPaginatedMovies(data);
};

export const fetchSimilarMovies = async (movieId) => {
  const data = await fetchFromTmdb(`movie/${movieId}/similar`, 'buscar filmes similares', {
    page: 1,
  });
  return normalizeMovieList(data.results ?? []);
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
