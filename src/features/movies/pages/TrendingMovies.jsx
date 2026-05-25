import React, { useCallback, useMemo, useState } from 'react';
import { fetchTrendingMovies } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const TIME_WINDOWS = {
  day: {
    label: 'Hoje',
    title: 'Em Tendência Hoje',
    seoDescription: 'Veja os filmes em maior destaque hoje no TMDB.',
  },
  week: {
    label: 'Esta Semana',
    title: 'Em Tendência na Semana',
    seoDescription: 'Veja os filmes em maior destaque da semana no TMDB.',
  },
};

const TrendingMovies = () => {
  const [timeWindow, setTimeWindow] = useState('week');

  const currentWindowConfig = TIME_WINDOWS[timeWindow] ?? TIME_WINDOWS.week;

  const fetchTrendingByWindow = useCallback(
    (page) => fetchTrendingMovies(timeWindow, page),
    [timeWindow]
  );

  const queryKey = useMemo(() => ['trending', timeWindow], [timeWindow]);

  const headerContent = (
    <div className="inline-flex rounded-xl border border-neutral-700 bg-neutral-900/80 p-1">
      {Object.entries(TIME_WINDOWS).map(([windowKey, config]) => {
        const isActive = timeWindow === windowKey;

        return (
          <button
            key={windowKey}
            type="button"
            onClick={() => setTimeWindow(windowKey)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold md:text-base ${
              isActive
                ? 'btn-minimal-rect btn-minimal-rect--active'
                : 'text-gray-300 transition-colors hover:bg-neutral-800 hover:text-white'
            }`}
            aria-pressed={isActive}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <PageSEO
        title={currentWindowConfig.title}
        description={currentWindowConfig.seoDescription}
        url={`/trending-movies?period=${timeWindow}`}
      />
      <MovieList
        title={currentWindowConfig.title}
        fetchFunction={fetchTrendingByWindow}
        queryKey={queryKey}
        headerContent={headerContent}
      />
    </>
  );
};

export default TrendingMovies;
