import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchMovieDetails, fetchMovieTrailer } from '../api';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';

const MovieDetails = () => {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [trailer, setTrailer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getMovieDetails = useCallback(async () => {
    try {
      const movieData = await fetchMovieDetails(id);
      const trailerData = await fetchMovieTrailer(id);
      setTrailer(trailerData);
      setMovie(movieData);
    } catch (err) {
      setError('Erro ao carregar os detalhes do filme.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getMovieDetails();
  }, [getMovieDetails]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;
  if (!movie) return null;

  return (
    <div className="relative p-6 bg-neutral-950 text-white min-h-screen">
      <img
        src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
        alt={movie.title}
        className="absolute inset-0 w-full h-full object-cover opacity-50"
      />
      <div className="relative z-10 p-4 bg-neutral-800 bg-opacity-75 rounded-md shadow-lg max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">{movie.title}</h1>
        {trailer ? (
          <div className="mt-4">
            <iframe
              className="w-full h-96 sm:h-80 lg:h-96 rounded-lg shadow-md"
              src={`https://www.youtube.com/embed/${trailer.key}`}
              title="Trailer"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="mt-4">Trailer não disponível.</p>
        )}
        <h1>ㅤ</h1>
        <p className="mb-4">{movie.overview}</p>
        <p>Lançamento: {movie.release_date}</p>
        <p className="mb-4">Avaliação: {movie.vote_average}</p>
        <div className="text-[#bd0003] text-xl">
          {Array(5).fill(0).map((_, index) => (
            index < Math.round(movie.vote_average / 2) ? '★' : '☆'
          ))}
        </div>
        <h2 className="text-2xl mt-4">Elenco:</h2>
        <ul className="list-disc pl-5">
          {movie.credits?.cast?.slice(0, 5).map(actor => (
            <li key={actor.id}>{actor.name} como {actor.character}</li>
          ))}
        </ul>
        <Link to="/" className="mt-4 inline-block bg-[#bd0003] text-white py-2 px-4 rounded hover:bg-red-700 transition-colors" aria-label="Voltar para a lista de filmes">
          Voltar
        </Link>
      </div>
    </div>
  );
};

export default MovieDetails;
