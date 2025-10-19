import React, { useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchPopularMovies,
  fetchTopRatedMovies,
  fetchNowPlayingMovies,
  fetchUpcomingMovies,
  fetchRecommendedMovies,
} from '../api';
import MovieSection from '../components/MovieSection';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import PageSEO from '../../../components/seo/PageSEO';
import { MovieContext } from '../context/MovieContext';
import { trackEvent } from '../../../lib/telemetry/logger';
import Hero from '../components/Hero';

const Home = () => {
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const { toWatchMovies, watchedMovies } = useContext(MovieContext);

  const {
    data: popularData,
    isLoading: popularLoading,
    error: popularError,
  } = useQuery({
    queryKey: ['movies', 'popular', 1],
    queryFn: () => fetchPopularMovies(1),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const {
    data: topRatedData,
    isLoading: topRatedLoading,
    error: topRatedError,
  } = useQuery({
    queryKey: ['movies', 'top-rated', 1],
    queryFn: () => fetchTopRatedMovies(1),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const {
    data: nowPlayingData,
    isLoading: nowPlayingLoading,
    error: nowPlayingError,
  } = useQuery({
    queryKey: ['movies', 'now-playing', 1],
    queryFn: () => fetchNowPlayingMovies(1),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const {
    data: upcomingData,
    isLoading: upcomingLoading,
    error: upcomingError,
  } = useQuery({
    queryKey: ['movies', 'upcoming', 1],
    queryFn: () => fetchUpcomingMovies(1),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const loading = popularLoading || topRatedLoading || nowPlayingLoading || upcomingLoading;
  const error = popularError || topRatedError || nowPlayingError || upcomingError;

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const favorites = [...toWatchMovies, ...watchedMovies];
        if (favorites.length === 0) {
          setRecommendedMovies([]);
          return;
        }

        const recommended = await fetchRecommendedMovies(favorites);
        setRecommendedMovies(recommended.slice(0, 12));
        trackEvent('recommended_movies_loaded', { count: recommended.length });
      } catch (err) {
        console.error('Erro ao carregar filmes recomendados:', err);
      }
    };

    fetchRecommendations();
  }, [toWatchMovies, watchedMovies]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorMessage message="Erro ao carregar os filmes." />;
  }

  const displayedPopularMovies = popularData?.results?.slice(0, 12) ?? [];
  const displayedTopRatedMovies = topRatedData?.results?.slice(0, 12) ?? [];
  const displayedNowPlayingMovies = nowPlayingData?.results?.slice(0, 12) ?? [];
  const displayedUpcomingMovies = upcomingData?.results?.slice(0, 12) ?? [];

  return (
    <div className="text-body">
      <PageSEO
        title="TelaViva"
        description="Descubra lançamentos, filmes populares e recomendações personalizadas na TelaViva."
        url="/"
      />
      <Hero />
      <div className="pt-12 md:pt-16 px-4 md:px-6 lg:px-8 xl:px-10">
        <MovieSection title="Em Cartaz" movies={displayedNowPlayingMovies} linkTo="/now-playing-movies" />

        {recommendedMovies.length > 0 ? (
          <MovieSection title="Recomendados para Você" movies={recommendedMovies} showViewAll={false} />
        ) : null}

        <MovieSection title="Maiores Avaliações" movies={displayedTopRatedMovies} linkTo="/top-rated-movies" />

        <MovieSection title="Populares" movies={displayedPopularMovies} linkTo="/popular-movies" />

        <MovieSection title="Lançamentos" movies={displayedUpcomingMovies} linkTo="/upcoming-movies" />
      </div>
    </div>
  );
};

export default Home;


