import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchPopularMovies,
  fetchTopRatedMovies,
  fetchTrendingNowMovies,
} from '../api';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

const HERO_TITLE_VARIANTS = {
  balanced: 'text-[clamp(3.1rem,8vw,7rem)] leading-[0.9] tracking-[0.035em]',
  compact: 'text-[clamp(1.9rem,7.3vw,6.5rem)] leading-[0.94] tracking-[0.02em]',
  epic: 'text-[clamp(3.4rem,8.8vw,7.6rem)] leading-[0.86] tracking-[0.055em]',
};

const ACTIVE_HERO_TITLE_VARIANT = 'compact';
const HERO_SOURCE_LIMIT = 18;

const getOverviewLength = (overview) => (typeof overview === 'string' ? overview.trim().length : 0);

const getReleaseRecencyBonus = (releaseDate) => {
  if (!releaseDate || typeof releaseDate !== 'string') {
    return 0;
  }

  const parsedReleaseDate = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(parsedReleaseDate.getTime())) {
    return 0;
  }

  const yearsDifference =
    (Date.now() - parsedReleaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  if (yearsDifference < 0) {
    return 1;
  }

  if (yearsDifference <= 1.5) {
    return 8;
  }

  if (yearsDifference <= 5) {
    return 5;
  }

  if (yearsDifference <= 12) {
    return 2;
  }

  if (yearsDifference >= 30) {
    return -4;
  }

  return 0;
};

const collectHeroCandidates = (sources = []) => {
  const dedupedCandidates = new Map();

  sources.forEach(({ movies, sourceBoost, rankBoost }) => {
    if (!Array.isArray(movies)) {
      return;
    }

    movies.slice(0, HERO_SOURCE_LIMIT).forEach((movie, index) => {
      if (!movie?.id || !movie?.backdrop_path) {
        return;
      }

      const existingCandidate = dedupedCandidates.get(movie.id) ?? {
        movie,
        sourceScore: 0,
        rankScore: 0,
        sourceCount: 0,
      };

      if (getOverviewLength(movie.overview) > getOverviewLength(existingCandidate.movie?.overview)) {
        existingCandidate.movie = movie;
      }

      existingCandidate.sourceScore += sourceBoost;
      existingCandidate.rankScore += Math.max(rankBoost - index, 0);
      existingCandidate.sourceCount += 1;

      dedupedCandidates.set(movie.id, existingCandidate);
    });
  });

  return Array.from(dedupedCandidates.values());
};

const calculateHeroCandidateScore = ({ movie, sourceScore, rankScore, sourceCount }) => {
  const rating = Number(movie?.vote_average ?? 0);
  const voteCount = Number(movie?.vote_count ?? 0);
  const popularity = Number(movie?.popularity ?? 0);
  const overviewLength = getOverviewLength(movie?.overview);

  const qualityScore = Math.max(rating - 6, 0) * 9;
  const confidenceScore = Math.log10(voteCount + 1) * 8;
  const popularityScore = Math.min(popularity, 180) / 10;
  const recencyScore = getReleaseRecencyBonus(movie?.release_date);
  const overviewScore =
    overviewLength >= 140
      ? 6
      : overviewLength >= 90
      ? 3
      : overviewLength >= 50
      ? 0
      : -8;
  const multiListBonus = (sourceCount - 1) * 5;

  return (
    sourceScore +
    rankScore +
    qualityScore +
    confidenceScore +
    popularityScore +
    recencyScore +
    overviewScore +
    multiListBonus
  );
};

const Hero = () => {
  const [isBackdropLoaded, setIsBackdropLoaded] = useState(false);

  const {
    data: popularData,
    isLoading: isPopularLoading,
    error: popularError,
  } = useQuery({
    queryKey: ['movies', 'popular', 1],
    queryFn: () => fetchPopularMovies(1),
    staleTime: 1000 * 60 * 8,
    gcTime: 1000 * 60 * 40,
  });

  const {
    data: trendingNowData,
    isLoading: isTrendingNowLoading,
    error: trendingNowError,
  } = useQuery({
    queryKey: ['movies', 'trending', 'day', 1],
    queryFn: () => fetchTrendingNowMovies(1),
    staleTime: 1000 * 60 * 8,
    gcTime: 1000 * 60 * 40,
  });

  const {
    data: topRatedData,
    isLoading: isTopRatedLoading,
    error: topRatedError,
  } = useQuery({
    queryKey: ['movies', 'top-rated', 1],
    queryFn: () => fetchTopRatedMovies(1),
    staleTime: 1000 * 60 * 8,
    gcTime: 1000 * 60 * 40,
  });

  const heroCandidates = useMemo(
    () => collectHeroCandidates([
      { movies: trendingNowData?.results, sourceBoost: 22, rankBoost: 13 },
      { movies: popularData?.results, sourceBoost: 15, rankBoost: 11 },
      { movies: topRatedData?.results, sourceBoost: 10, rankBoost: 9 },
    ]),
    [trendingNowData, popularData, topRatedData]
  );

  const fallbackMovie =
    popularData?.results?.find((movie) => movie?.backdrop_path) ??
    trendingNowData?.results?.find((movie) => movie?.backdrop_path) ??
    topRatedData?.results?.find((movie) => movie?.backdrop_path) ??
    null;

  const featuredMovie = useMemo(() => {
    if (heroCandidates.length === 0) {
      return fallbackMovie;
    }

    return heroCandidates
      .map((candidate) => ({
        movie: candidate.movie,
        score: calculateHeroCandidateScore(candidate),
      }))
      .sort((firstCandidate, secondCandidate) => secondCandidate.score - firstCandidate.score)[0]?.movie ?? fallbackMovie;
  }, [heroCandidates, fallbackMovie]);

  const backdropUrl = featuredMovie?.backdrop_path
    ? `${IMAGE_BASE_URL}${featuredMovie.backdrop_path}`
    : null;
  const heroTitleClass =
    HERO_TITLE_VARIANTS[ACTIVE_HERO_TITLE_VARIANT] ?? HERO_TITLE_VARIANTS.balanced;

  const hasAnyMovieData = Boolean(
    popularData?.results?.length ||
    trendingNowData?.results?.length ||
    topRatedData?.results?.length
  );

  const isHeroLoading =
    (isPopularLoading || isTrendingNowLoading || isTopRatedLoading) && !hasAnyMovieData;
  const heroError = !hasAnyMovieData
    ? (popularError || trendingNowError || topRatedError)
    : null;

  useEffect(() => {
    setIsBackdropLoaded(false);
  }, [backdropUrl]);

  if (isHeroLoading) {
    return (
      <div className="w-full h-[60vh] bg-neutral-800 flex items-center justify-center">
        <Loading fullScreen={false} />
      </div>
    );
  }

  if (heroError) {
    return (
      <div className="w-full h-[60vh] bg-neutral-800 flex items-center justify-center">
        <ErrorMessage message="Não foi possível carregar o destaque." />
      </div>
    );
  }

  if (!featuredMovie || !backdropUrl) {
    return null;
  }

  return (
    <div
      className="relative w-full h-[75vh] overflow-hidden bg-neutral-900 text-white"
    >
      <img
        src={backdropUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onLoad={() => setIsBackdropLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isBackdropLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-0 bg-neutral-900 transition-opacity duration-500 ${
          isBackdropLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent via-black/70 to-black" />
      <div className="relative z-10 flex flex-col justify-center h-full px-5 sm:px-8 md:px-16 lg:px-24 w-full md:w-3/5 lg:w-1/2">
        <h1 className={`font-display uppercase drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] ${heroTitleClass}`}>
          {featuredMovie.title}
        </h1>
        <p className="mt-3 sm:mt-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base font-light leading-relaxed text-gray-100 drop-shadow-md md:text-lg">
          {featuredMovie.overview?.trim() || 'Descubra por que este título está em destaque hoje na TelaViva.'}
        </p>
        <Link
          to={`/movie/${featuredMovie.id}`}
          className="link-underline-action mt-5 sm:mt-8 w-fit text-xs font-semibold uppercase tracking-[0.14em] md:text-sm"
        >
          Ver Detalhes
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
  );
};

export default Hero;


