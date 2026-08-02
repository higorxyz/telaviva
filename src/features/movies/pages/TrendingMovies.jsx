import React, { useCallback, useMemo, useState } from 'react';
import { fetchTrendingMovies } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const TIME_WINDOWS = {
  day: {
    label: 'Hoje',
    title: 'Tendências de hoje',
    seoDescription: 'Veja os filmes em maior destaque hoje no TMDB.',
  },
  week: {
    label: 'Esta semana',
    title: 'Tendências da semana',
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
    <div className="inline-flex items-center gap-5 md:gap-6">
      {Object.entries(TIME_WINDOWS).map(([windowKey, config]) => {
        const isActive = timeWindow === windowKey;

        return (
          <button
            key={windowKey}
            type="button"
            onClick={() => setTimeWindow(windowKey)}
            className={`group relative pb-1 text-sm font-semibold transition-colors duration-300 md:text-base ${
              isActive ? 'text-tv-accent' : 'text-gray-300 hover:text-tv-accent'
            }`}
            aria-pressed={isActive}
          >
            {config.label}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 -bottom-0.5 h-px origin-left transform transition-all duration-300 ${
                isActive
                  ? 'scale-x-100 bg-tv-accent opacity-100'
                  : 'scale-x-90 bg-gray-500/70 opacity-70 group-hover:scale-x-100 group-hover:bg-tv-accent group-hover:opacity-100'
              }`}
            />
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
