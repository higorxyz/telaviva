//tmdb

const API_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.REACT_APP_TMDB_API_KEY;

const handleApiError = (error, context) => {
  console.error(`Erro em ${context}:`, error);
  throw new Error(`Erro ao ${context}`);
};

export const fetchPopularMovies = async (page = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/popular?api_key=${API_KEY}&language=pt-BR&page=${page}`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar filmes populares');
  }
};

export const fetchTopRatedMovies = async (page = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=pt-BR&page=${page}`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar filmes mais avaliados');
  }
};

export const fetchNowPlayingMovies = async (page = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/now_playing?api_key=${API_KEY}&language=pt-BR&page=${page}`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar filmes em cartaz');
  }
};

export const fetchUpcomingMovies = async (page = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/upcoming?api_key=${API_KEY}&language=pt-BR&page=${page}`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar próximos lançamentos');
  }
};

export const fetchMovieDetails = async (movieId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/${movieId}?api_key=${API_KEY}&language=pt-BR&append_to_response=translations`);
    if (!response.ok) throw new Error('Erro ao buscar detalhes do filme');
    const data = await response.json();
    const translation = data.translations?.translations.find((t) => t.iso_639_1 === 'pt' && t.data.title);
    if (translation && translation.data.title) data.title = translation.data.title;
    return data;
  } catch (error) {
    handleApiError(error, 'buscar detalhes do filme');
  }
};

export const fetchMoviesByCategory = async (categoryId, page = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${categoryId}&language=pt-BR&page=${page}`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar filmes por categoria');
  }
};

export const fetchMovieTrailer = async (movieId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=pt-BR`);
    if (!response.ok) throw new Error('Erro ao buscar trailer do filme');
    const data = await response.json();
    return data.results.length > 0 ? data.results[0] : null;
  } catch (error) {
    handleApiError(error, 'buscar trailer do filme');
  }
};

export const fetchCategories = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=pt-BR`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.genres;
  } catch (error) {
    handleApiError(error, 'buscar categorias');
  }
};

export const fetchMovieCast = async (movieId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/${movieId}/credits?api_key=${API_KEY}&language=pt-BR`);
    if (!response.ok) throw new Error('Erro ao buscar elenco do filme');
    const data = await response.json();
    return data.cast;
  } catch (error) {
    handleApiError(error, 'buscar elenco do filme');
  }
};

export const fetchMoviesBySearch = async (query, page = 1) => {
  try {
    const response = await fetch(`${API_BASE_URL}/search/movie?api_key=${API_KEY}&query=${query}&language=pt-BR&page=${page}`);
    if (!response.ok) throw new Error('Erro na requisição');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar filmes');
  }
};

export const fetchSimilarMovies = async (movieId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/movie/${movieId}/similar?api_key=${API_KEY}&language=pt-BR&page=1`);
    if (!response.ok) throw new Error('Erro ao buscar filmes similares');
    const data = await response.json();
    return data.results;
  } catch (error) {
    handleApiError(error, 'buscar filmes similares');
  }
};

export const fetchRecommendedMovies = async (movies) => {
  try {
    // Limita a 5 filmes para evitar muitas chamadas
    const limitedMovies = movies.slice(0, 5);
    const recommendedMovies = [];
    
    // Busca filmes similares em paralelo para melhor performance
    const similarMoviesPromises = limitedMovies.map(movie => fetchSimilarMovies(movie.id));
    const similarMoviesResults = await Promise.all(similarMoviesPromises);
    
    similarMoviesResults.forEach(similarMovies => {
      recommendedMovies.push(...similarMovies);
    });
    
    // Remove duplicatas e limita a 20 filmes
    const uniqueMovies = Array.from(new Set(recommendedMovies.map(a => a.id)))
      .map(id => recommendedMovies.find(a => a.id === id))
      .slice(0, 20);
      
    return uniqueMovies;
  } catch (error) {
    console.error('Erro ao buscar filmes recomendados:', error);
    return [];
  }
};

export const fetchMoviesFromLocalStorage = () => {
  const watchedMovies = JSON.parse(localStorage.getItem('watchedMovies')) || [];
  const toWatchMovies = JSON.parse(localStorage.getItem('toWatchMovies')) || [];
  return { watchedMovies, toWatchMovies };
};

