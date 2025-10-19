export const normalizeMovie = (movie = {}) => {
  if (!movie || typeof movie !== 'object') {
    return null;
  }

  const fallbackTitle = movie.name || movie.original_title || 'Título indisponível';

  return {
    ...movie,
    id: movie.id ?? null,
    title: movie.title || fallbackTitle,
    original_title: movie.original_title || fallbackTitle,
    poster_path: movie.poster_path ?? null,
    backdrop_path: movie.backdrop_path ?? null,
    vote_average: typeof movie.vote_average === 'number' ? movie.vote_average : 0,
    release_date: movie.release_date ?? movie.first_air_date ?? null,
    original_language: movie.original_language || 'en',
  };
};

export const normalizeMovieList = (movies = []) =>
  movies
    .map(normalizeMovie)
    .filter((movie) => movie && movie.id != null);

export const mergeMovieData = (baseMovie, overrides = {}) => {
  const normalizedBase = normalizeMovie(baseMovie) || {};
  const normalizedOverrides = normalizeMovie({ ...normalizedBase, ...overrides }) || {};
  return {
    ...normalizedBase,
    ...overrides,
    ...normalizedOverrides,
  };
};


