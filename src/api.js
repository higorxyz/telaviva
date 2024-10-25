const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.REACT_APP_TMDB_API_KEY;

export const fetchPopularMovies = async () => {
  const response = await fetch(`${API_BASE_URL}/movie/popular?api_key=${API_KEY}&language=pt-BR`);
  const data = await response.json();
  return data.results;
};

export const fetchMovieDetails = async (movieId) => {
  const response = await fetch(`${API_BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=pt-BR`);
  if (!response.ok) {
    throw new Error('Erro ao buscar detalhes do filme');
  }
  return response.json();
};

export const fetchMoviesByCategory = async (categoryId) => {
  const response = await fetch(`${API_BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${categoryId}`);
  const data = await response.json();
  return data.results;
};

export const fetchMovieTrailer = async (movieId) => {
  const response = await fetch(`${API_BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=pt-BR`);
  if (!response.ok) {
    throw new Error('Erro ao buscar trailer do filme');
  }
  const data = await response.json();
  return data.results.length > 0 ? data.results[0] : null; 
};

export const fetchCategories = async () => {
  const response = await fetch(`${API_BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=pt-BR`);
  const data = await response.json();
  return data.genres;
};

export const fetchMovieCast = async (movieId) => {
  const response = await fetch(`${API_BASE_URL}/movie/${movieId}/credits?api_key=${API_KEY}&language=pt-BR`);
  if (!response.ok) {
    throw new Error('Erro ao buscar elenco do filme');
  }
  const data = await response.json();
  return data.cast;
};
