import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api';

const extractGenreIds = (movie) => {
  if (Array.isArray(movie.genre_ids)) {
    return movie.genre_ids;
  }

  if (Array.isArray(movie.genres)) {
    return movie.genres
      .map((genre) => genre?.id)
      .filter((genreId) => Number.isFinite(Number(genreId)));
  }

  return [];
};

const LibraryInsights = ({ watchedMovies, toWatchMovies, className = '', cardClassName = 'bg-neutral-900/50' }) => {
  const { data: genres = [] } = useQuery({
    queryKey: ['genres'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const genreNameById = useMemo(() => {
    const entries = genres.map((genre) => [Number(genre.id), genre.name]);
    return new Map(entries);
  }, [genres]);

  const trackedMovies = watchedMovies.length + toWatchMovies.length;
  const watchedCompletion = trackedMovies > 0 ? Math.round((watchedMovies.length / trackedMovies) * 100) : 0;

  const averageWatchedRating = useMemo(() => {
    const ratedMovies = watchedMovies.filter((movie) => Number(movie.vote_average) > 0);

    if (ratedMovies.length === 0) {
      return null;
    }

    const totalRating = ratedMovies.reduce((accumulator, movie) => accumulator + Number(movie.vote_average), 0);
    return (totalRating / ratedMovies.length).toFixed(1);
  }, [watchedMovies]);

  const favoriteMovie = useMemo(() => {
    if (watchedMovies.length === 0) {
      return null;
    }

    const sortedByRating = [...watchedMovies].sort((firstMovie, secondMovie) => {
      const firstScore = Number(firstMovie.vote_average) || 0;
      const secondScore = Number(secondMovie.vote_average) || 0;
      return secondScore - firstScore;
    });

    return sortedByRating[0] || null;
  }, [watchedMovies]);

  const topGenres = useMemo(() => {
    const genreCount = new Map();

    [...watchedMovies, ...toWatchMovies].forEach((movie) => {
      extractGenreIds(movie).forEach((genreId) => {
        const normalizedGenreId = Number(genreId);
        genreCount.set(normalizedGenreId, (genreCount.get(normalizedGenreId) || 0) + 1);
      });
    });

    return Array.from(genreCount.entries())
      .sort((firstGenre, secondGenre) => secondGenre[1] - firstGenre[1])
      .slice(0, 3)
      .map(([genreId, count]) => ({
        id: genreId,
        name: genreNameById.get(genreId) || `Gênero ${genreId}`,
        count,
      }));
  }, [genreNameById, toWatchMovies, watchedMovies]);

  const sectionClassName = className.trim().length > 0 ? className : 'mb-12';

  return (
    <section className={sectionClassName}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-tv-accent">Seu painel</p>
          <h2 className="mt-1 text-2xl font-bold text-white md:text-3xl">Radar da sua biblioteca</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/watched-movies"
            className="link-underline-action text-xs font-medium"
          >
            Assistidos
            <svg
              className="link-underline-action__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            to="/to-watch-movies"
            className="link-underline-action text-xs font-medium"
          >
            Ver depois
            <svg
              className="link-underline-action__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            to="/discover?sortBy=vote_average.desc&minVotes=500"
            className="link-underline-action text-xs font-semibold"
          >
            Descobrir melhores notas
            <svg
              className="link-underline-action__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-2xl p-4 ${cardClassName}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Total acompanhado</p>
          <p className="mt-2 text-3xl font-bold text-white">{trackedMovies}</p>
          <p className="mt-1 text-sm text-gray-400">{watchedCompletion}% já concluído</p>
        </div>

        <div className={`rounded-2xl p-4 ${cardClassName}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Média dos assistidos</p>
          <p className="mt-2 text-3xl font-bold text-white">{averageWatchedRating ? `${averageWatchedRating}/10` : '-'}</p>
          <p className="mt-1 text-sm text-gray-400">Com base em {watchedMovies.length} títulos</p>
        </div>

        <div className={`rounded-2xl p-4 ${cardClassName}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Melhor nota da lista</p>
          <p className="mt-2 line-clamp-2 text-lg font-semibold text-white">
            {favoriteMovie ? favoriteMovie.title : 'Adicione filmes assistidos'}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {favoriteMovie ? `Nota ${Number(favoriteMovie.vote_average || 0).toFixed(1)}` : 'Seu ranking aparece aqui'}
          </p>
        </div>

        <div className={`rounded-2xl p-4 ${cardClassName}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Gêneros em destaque</p>
          {topGenres.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">Comece a salvar filmes para gerar insights.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-gray-200">
              {topGenres.map((genre) => (
                <li key={genre.id} className="flex items-center justify-between">
                  <span>{genre.name}</span>
                  <span className="text-xs text-gray-400">{genre.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default LibraryInsights;
