import React, { useEffect, useState, useCallback, useRef, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchMovieDetails, fetchMovieTrailer, fetchMovieCast } from '../api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import { MovieContext } from '../context/MovieContext';

const MovieDetails = () => {
  const { id } = useParams();
  const { addToWatched, addToToWatch, watchedMovies, toWatchMovies, removeFromWatched, removeFromToWatch } = useContext(MovieContext);
  const [movie, setMovie] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [cast, setCast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const castRef = useRef(null);

  const getMovieDetails = useCallback(async () => {
    try {
      const movieData = await fetchMovieDetails(id);
      const trailerData = await fetchMovieTrailer(id);
      const castData = await fetchMovieCast(id);

      setMovie(movieData);
      setTrailer(trailerData);
      setCast(castData);
    } catch (err) {
      setError('Erro ao carregar os detalhes do filme.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getMovieDetails();
  }, [getMovieDetails]);

  const scrollLeft = () => {
    castRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    castRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;

    event.preventDefault();

    const startX = event.clientX;
    const scrollLeft = castRef.current.scrollLeft;

    const handleMouseMove = (event) => {
      const x = event.clientX - startX;
      castRef.current.scrollLeft = scrollLeft - x;
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      castRef.current.style.cursor = 'grab';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    castRef.current.style.cursor = 'grabbing';
  };

  const handleImageMouseDown = (event) => {
    event.preventDefault();
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!movie) return null;

  const releaseDate = new Date(movie.release_date).toLocaleDateString('pt-BR');
  const voteAverage = movie.vote_average.toFixed(1);

  const isWatched = watchedMovies.some((m) => m.id === movie.id);
  const isToWatch = toWatchMovies.some((m) => m.id === movie.id);
  const handleToggleWatched = () => {
    if (isWatched) {
      removeFromWatched(movie.id);
    } else {
      addToWatched(movie);
    }
  };

  const handleToggleToWatch = () => {
    if (isToWatch) {
      removeFromToWatch(movie.id);
    } else {
      addToToWatch(movie);
    }
  };

  return (
    <div className="relative p-8 movie-details bg-neutral-950 text-white min-h-screen">
      <img
        src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
        alt={movie.title}
        className="absolute inset-0 w-full h-full object-cover opacity-50"
      />
      <div className="relative z-10 p-12 bg-neutral-800 bg-opacity-75 rounded-xl shadow-lg max-w-3xl mx-auto">
        <h1 className="pt-4 pb-8 text-4xl font-bold">{movie.title}</h1>
        {trailer ? (
          <div className="mt-8">
            <iframe
              className="w-full h-auto sm:h-auto lg:h-96 rounded-2xl shadow-md"
              src={`https://www.youtube.com/embed/${trailer.key}`}
              title="Trailer"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="mt-8">Trailer não disponível.</p>
        )}
        <h1>ㅤ</h1>
        <div className="flex space-x-4 my-4">
          <button
            onClick={handleToggleWatched}
            className={`py-2 px-4 rounded ${isWatched ? 'bg-white text-black' : 'bg-[#bd0003] text-white'}`}
          >
            {isWatched ? 'Remover dos Assistidos' : 'Adicionar aos Assistidos'}
          </button>
          <button
            onClick={handleToggleToWatch}
            className={`py-2 px-4 rounded ${isToWatch ? 'bg-white text-black' : 'bg-[#bd0003] text-white'}`}
          >
            {isToWatch ? 'Remover da Lista à Assistir' : 'Adicionar à Lista para Assistir'}
          </button>
        </div>
        <p className="mb-8">{movie.overview}</p>
        <p>Lançamento: {releaseDate}</p>
        <p className="mt-2 mb-8">
          Avaliação: {Array(5).fill(0).map((_, index) => (
            <span key={index} className="text-yellow-500">
              {index < Math.round(movie.vote_average / 2) ? '★' : '☆'}
            </span>
          ))} ({voteAverage})
        </p>
        <h2 className="text-2xl my-4">Elenco:</h2>
        <div className="relative">
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 p-2 bg-[#bd0003] rounded-full hover:bg-red-500"
            aria-label="Scroll para a esquerda"
          >
            ←
          </button>
          <div
            ref={castRef}
            className="flex overflow-x-auto space-x-4 pb-4 cursor-grab"
            onMouseDown={handleMouseDown}
          >
            {cast.map((actor) => (
              <div key={actor.id} className="flex-shrink-0 w-24 text-center">
                <img
                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                  alt={actor.name}
                  className="w-full h-auto rounded-md"
                  onMouseDown={handleImageMouseDown}
                />
                <p className="text-sm mt-1">{actor.name}</p>
              </div>
            ))}
          </div>
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 p-2 bg-[#bd0003] rounded-full hover:bg-red-500"
            aria-label="Scroll para a direita"
          >
            →
          </button>
        </div>
        <Link
          to="/"
          className="mt-4 inline-block bg-[#bd0003] text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
          aria-label="Voltar para a lista de filmes"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
};

export default MovieDetails;