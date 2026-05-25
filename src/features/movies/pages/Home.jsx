import React, { useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchBlockbusterMovies,
  fetchHiddenGemMovies,
  fetchPopularMovies,
  fetchShortRuntimeMovies,
  fetchStreamingMovies,
  fetchTopRatedMovies,
  fetchNowPlayingMovies,
  fetchTrendingNowMovies,
  fetchUpcomingMovies,
  fetchTrendingMovies,
  fetchRecommendedMovies,
} from '../api';
import MovieSection from '../components/MovieSection';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import PageSEO from '../../../components/seo/PageSEO';
import { MovieContext } from '../context/MovieContext';
import { trackEvent } from '../../../lib/telemetry/logger';
import Hero from '../components/Hero';
import LibraryInsights from '../components/LibraryInsights';

const SECTION_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();

const QUERY_DEFAULTS = {
  staleTime: 1000 * 60 * 8,
  gcTime: 1000 * 60 * 40,
};

const QUICK_ACTIONS = [
  {
    title: 'Noite curta',
    description: 'Filmes de até 100 minutos para maratonar sem cansar.',
    cta: 'Ver curadoria',
    to: '/discover?maxRuntime=100&sortBy=popularity.desc&minVotes=120',
  },
  {
    title: 'Nota alta validada',
    description: 'Apenas títulos muito bem avaliados com base robusta de votos.',
    cta: 'Abrir filtro',
    to: '/discover?minRating=8&minVotes=1000&sortBy=vote_average.desc',
  },
  {
    title: 'Streaming no Brasil',
    description: 'Descubra filmes com disponibilidade de streaming em BR.',
    cta: 'Explorar streaming',
    to: '/discover?region=BR&sortBy=popularity.desc',
  },
  {
    title: `Lançamentos ${CURRENT_YEAR}`,
    description: 'Recorte rápido dos títulos mais comentados do ano atual.',
    cta: 'Ver lançamentos',
    to: `/discover?year=${CURRENT_YEAR}&sortBy=popularity.desc`,
  },
];

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
    ...QUERY_DEFAULTS,
  });

  const {
    data: topRatedData,
    error: topRatedError,
  } = useQuery({
    queryKey: ['movies', 'top-rated', 1],
    queryFn: () => fetchTopRatedMovies(1),
    ...QUERY_DEFAULTS,
  });

  const {
    data: nowPlayingData,
    error: nowPlayingError,
  } = useQuery({
    queryKey: ['movies', 'now-playing', 1],
    queryFn: () => fetchNowPlayingMovies(1),
    ...QUERY_DEFAULTS,
  });

  const {
    data: upcomingData,
    error: upcomingError,
  } = useQuery({
    queryKey: ['movies', 'upcoming', 'strict-future', 1],
    queryFn: () => fetchUpcomingMovies(1),
    ...QUERY_DEFAULTS,
  });

  const {
    data: trendingNowData,
    isLoading: trendingNowLoading,
    error: trendingNowError,
  } = useQuery({
    queryKey: ['movies', 'trending', 'day', 1],
    queryFn: () => fetchTrendingNowMovies(1),
    ...QUERY_DEFAULTS,
  });

  const {
    data: trendingData,
    isLoading: trendingWeekLoading,
    error: trendingWeekError,
  } = useQuery({
    queryKey: ['movies', 'trending', 'week', 1],
    queryFn: () => fetchTrendingMovies('week', 1),
    ...QUERY_DEFAULTS,
  });

  const { data: hiddenGemData } = useQuery({
    queryKey: ['movies', 'hidden-gems', 1],
    queryFn: () => fetchHiddenGemMovies(1),
    ...QUERY_DEFAULTS,
  });

  const { data: blockbusterData } = useQuery({
    queryKey: ['movies', 'blockbusters', 1],
    queryFn: () => fetchBlockbusterMovies(1),
    ...QUERY_DEFAULTS,
  });

  const { data: shortRuntimeData } = useQuery({
    queryKey: ['movies', 'short-runtime', 1],
    queryFn: () => fetchShortRuntimeMovies(1),
    ...QUERY_DEFAULTS,
  });

  const { data: streamingData } = useQuery({
    queryKey: ['movies', 'streaming', 'BR', 1],
    queryFn: () => fetchStreamingMovies(1, 'BR'),
    ...QUERY_DEFAULTS,
  });

  const isFirstPaintLoading =
    (popularLoading && !popularData) ||
    (trendingNowLoading && !trendingNowData) ||
    (trendingWeekLoading && !trendingData);

  const firstPaintError =
    (popularError && !popularData) ||
    (trendingNowError && !trendingNowData) ||
    (trendingWeekError && !trendingData) ||
    (topRatedError && !topRatedData) ||
    (nowPlayingError && !nowPlayingData) ||
    (upcomingError && !upcomingData);

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

  if (isFirstPaintLoading) {
    return <Loading />;
  }

  if (firstPaintError) {
    return <ErrorMessage message="Erro ao carregar os filmes." />;
  }

  const displayedPopularMovies = popularData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedTopRatedMovies = topRatedData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedNowPlayingMovies = nowPlayingData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedUpcomingMovies = upcomingData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedTrendingWeekMovies = trendingData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedTrendingNowMovies = trendingNowData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedHiddenGemMovies = hiddenGemData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedBlockbusterMovies = blockbusterData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedShortRuntimeMovies = shortRuntimeData?.results?.slice(0, SECTION_SIZE) ?? [];
  const displayedStreamingMovies = streamingData?.results?.slice(0, SECTION_SIZE) ?? [];

  const orderedSections = [
    recommendedMovies.length > 0
      ? {
          id: 'recommended',
          title: 'Recomendados para você',
          movies: recommendedMovies,
          showViewAll: false,
        }
      : null,
    {
      id: 'trending-now',
      title: 'Bombando hoje',
      movies: displayedTrendingNowMovies,
      linkTo: '/trending-movies',
    },
    {
      id: 'now-playing',
      title: 'Em cartaz agora',
      movies: displayedNowPlayingMovies,
      linkTo: '/now-playing-movies',
    },
    {
      id: 'streaming-br',
      title: 'Streaming em alta no Brasil',
      movies: displayedStreamingMovies,
      linkTo: '/discover?region=BR&sortBy=popularity.desc',
    },
    {
      id: 'hidden-gems',
      title: 'Jóias escondidas',
      movies: displayedHiddenGemMovies,
      linkTo: '/discover?minRating=7.2&minVotes=120&sortBy=vote_average.desc',
    },
    {
      id: 'blockbusters',
      title: 'Blockbusters de bilheteria',
      movies: displayedBlockbusterMovies,
      linkTo: '/discover?sortBy=revenue.desc&minVotes=1000',
    },
    {
      id: 'top-rated',
      title: 'Mais bem avaliados',
      movies: displayedTopRatedMovies,
      linkTo: '/top-rated-movies',
    },
    {
      id: 'short-runtime',
      title: 'Curtos para hoje',
      movies: displayedShortRuntimeMovies,
      linkTo: '/discover?maxRuntime=100&sortBy=popularity.desc',
    },
    {
      id: 'upcoming',
      title: 'Próximos lançamentos',
      movies: displayedUpcomingMovies,
      linkTo: '/upcoming-movies',
    },
    {
      id: 'trending-week',
      title: 'Tendências da semana',
      movies: displayedTrendingWeekMovies,
      linkTo: '/trending-movies',
    },
    {
      id: 'popular',
      title: 'Populares no momento',
      movies: displayedPopularMovies,
      linkTo: '/popular-movies',
    },
  ].filter((section) => section && section.movies.length > 0);

  return (
    <div className="text-body">
      <PageSEO
        title="TelaViva"
        description="Home editorial da TelaViva com tendências diárias, streaming no Brasil, curadorias inteligentes e recomendações personalizadas."
        url="/"
      />
      <Hero />

      <div className="pt-12 md:pt-16 px-4 md:px-6 lg:px-8 xl:px-10">
        {orderedSections.map((section) => (
          <MovieSection
            key={section.id}
            title={section.title}
            movies={section.movies}
            linkTo={section.linkTo}
            showViewAll={section.showViewAll ?? true}
          />
        ))}

        <section className="relative mb-6 mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-neutral-950/70 via-black to-neutral-950/70 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-500/28 to-transparent" />
          <div className="pointer-events-none absolute -top-16 right-1/4 h-44 w-44 rounded-full bg-neutral-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-neutral-700/10 blur-3xl" />

          <div className="relative">
            <section className="mb-8">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-tv-accent">Área pessoal</p>
                  <h2 className="mt-1 text-2xl font-bold text-white md:text-3xl">Seu espaço de curadoria</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Atalhos para descobrir mais rápido e manter sua próxima sessão organizada.
                  </p>
                </div>
                <Link
                  to="/discover"
                  className="link-underline-action text-sm font-semibold"
                >
                  Abrir descoberta completa
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

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {QUICK_ACTIONS.map((action, index) => (
                  <Link
                    key={action.title}
                    to={action.to}
                    className="group rounded-2xl bg-neutral-900/22 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-neutral-900/42"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Rota rápida {index + 1}
                    </span>
                    <h3 className="mt-1 text-lg font-semibold text-white">{action.title}</h3>
                    <p className="mt-2 min-h-[44px] text-sm text-gray-400">{action.description}</p>
                    <span className="mt-3 inline-flex items-center text-sm font-semibold text-gray-200 transition-colors group-hover:text-tv-accent">
                      {action.cta}
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
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <LibraryInsights
              watchedMovies={watchedMovies}
              toWatchMovies={toWatchMovies}
              className="mt-2"
              cardClassName="bg-neutral-900/30"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;


