import React, { useContext, useRef, useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchMovieDetails,
  fetchMovieTrailer,
  fetchMovieCast,
  fetchMovieWatchProviders,
} from '../api';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import { MovieContext } from '../context/MovieContext';
import PageSEO from '../../../components/seo/PageSEO';
import {
  FaCheck,
  FaPlus,
  FaClock,
  FaStar,
  FaCalendar,
  FaHome,
  FaChevronLeft,
  FaChevronRight,
} from 'react-icons/fa';

const PROVIDER_CATEGORY_LABELS = {
  flatrate: 'Streaming',
  free: 'Grátis',
  ads: 'Com anúncios',
  rent: 'Aluguel',
  buy: 'Compra',
};

const PROVIDER_DISPLAY_ORDER = ['flatrate', 'free', 'ads', 'rent', 'buy'];
const BRAZIL_REGION_CODE = 'BR';
const BRAZIL_RELEASE_TYPES = new Set([2, 3]);
const SECTION_CARD_CLASS =
  'py-1 md:py-2';
const STAT_CARD_CLASS =
  'relative overflow-hidden rounded-xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 p-3 md:p-4 text-center';
const ACTION_BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
const ACTION_BUTTON_PRIMARY_CLASS =
  `${ACTION_BUTTON_BASE_CLASS} border border-neutral-700 bg-gradient-to-r from-tv-accent via-red-600 to-red-500 text-white shadow-[0_18px_34px_-20px_rgba(229,9,20,0.95)] hover:-translate-y-0.5 hover:border-neutral-500 hover:from-red-600 hover:to-tv-accent hover:shadow-[0_24px_40px_-20px_rgba(229,9,20,0.95)] focus-visible:ring-tv-accent/60`;
const ACTION_BUTTON_NEUTRAL_CLASS =
  `${ACTION_BUTTON_BASE_CLASS} border border-neutral-700/90 bg-gradient-to-b from-neutral-900 to-neutral-950 text-gray-100 shadow-[0_18px_34px_-24px_rgba(0,0,0,0.88)] hover:-translate-y-0.5 hover:border-tv-accent/35 hover:text-white hover:shadow-[0_24px_40px_-26px_rgba(229,9,20,0.35)] focus-visible:ring-tv-accent/35`;
const ACTION_BUTTON_SUCCESS_CLASS =
  `${ACTION_BUTTON_BASE_CLASS} border border-neutral-300/65 bg-neutral-100 text-neutral-900 shadow-[0_18px_34px_-24px_rgba(255,255,255,0.55)] hover:-translate-y-0.5 hover:border-white hover:bg-white focus-visible:ring-neutral-300/70`;
const ACTION_BUTTON_ACTIVE_CLASS =
  `${ACTION_BUTTON_BASE_CLASS} border border-neutral-700 bg-black text-white shadow-[0_18px_34px_-24px_rgba(0,0,0,0.9)] hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-950 focus-visible:ring-neutral-500/60`;
const NAV_BUTTON_BASE_CLASS =
  'inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-300 md:px-8 md:py-3 md:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
const NAV_PRIMARY_BUTTON_CLASS =
  `${NAV_BUTTON_BASE_CLASS} border border-neutral-700 bg-gradient-to-r from-tv-accent via-red-600 to-red-500 text-white shadow-[0_20px_38px_-20px_rgba(229,9,20,0.9)] hover:-translate-y-0.5 hover:from-red-600 hover:to-tv-accent hover:shadow-[0_26px_42px_-20px_rgba(229,9,20,0.9)] focus-visible:ring-tv-accent/60`;
const NAV_SECONDARY_BUTTON_CLASS =
  `${NAV_BUTTON_BASE_CLASS} border border-neutral-700 bg-neutral-900/85 text-gray-100 shadow-[0_18px_34px_-24px_rgba(0,0,0,0.85)] hover:-translate-y-0.5 hover:border-neutral-500 hover:bg-neutral-800/90 focus-visible:ring-neutral-500/60`;

const normalizeDateValue = (rawDate) => {
  if (!rawDate || typeof rawDate !== 'string') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    return rawDate.slice(0, 10);
  }

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
};

const formatDateForDisplay = (rawDate) => {
  const normalizedDate = normalizeDateValue(rawDate);

  if (!normalizedDate) {
    return 'Data não disponível';
  }

  return new Date(`${normalizedDate}T00:00:00`).toLocaleDateString('pt-BR');
};

const getRegionReleaseDate = (releaseDatesPayload, regionCode) => {
  const results = Array.isArray(releaseDatesPayload?.results) ? releaseDatesPayload.results : [];

  const regionData = results.find((item) => item?.iso_3166_1 === regionCode);
  if (!regionData) {
    return null;
  }

  const releaseDates = Array.isArray(regionData.release_dates)
    ? regionData.release_dates
        .map((item) => ({
          type: Number(item?.type),
          date: normalizeDateValue(item?.release_date),
        }))
        .filter((item) => item.date)
    : [];

  if (releaseDates.length === 0) {
    return null;
  }

  const theatricalDates = releaseDates.filter((item) => BRAZIL_RELEASE_TYPES.has(item.type));
  const selectedDates = theatricalDates.length > 0 ? theatricalDates : releaseDates;

  selectedDates.sort((firstItem, secondItem) => firstItem.date.localeCompare(secondItem.date));

  return selectedDates[0]?.date ?? null;
};

const detectRegionByLocale = () => {
  if (typeof navigator === 'undefined') {
    return 'BR';
  }

  const locale = navigator.languages?.[0] || navigator.language || '';
  const localeParts = locale.split(/[-_]/);
  const region = localeParts[1];

  if (region && region.length === 2) {
    return region.toUpperCase();
  }

  return 'BR';
};

const MovieDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    addToWatched,
    addToToWatch,
    watchedMovies,
    toWatchMovies,
    removeFromWatched,
    removeFromToWatch,
  } = useContext(MovieContext);
  const castRef = useRef(null);
  const providerRegion = useMemo(() => detectRegionByLocale(), []);

  const {
    data: movie,
    isLoading: isMovieLoading,
    error: movieError,
  } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => fetchMovieDetails(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const { data: trailer, isLoading: isTrailerLoading } = useQuery({
    queryKey: ['movie', id, 'trailer'],
    queryFn: () => fetchMovieTrailer(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const { data: castData, isLoading: isCastLoading } = useQuery({
    queryKey: ['movie', id, 'cast'],
    queryFn: () => fetchMovieCast(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const { data: watchProvidersData, isLoading: isWatchProvidersLoading } = useQuery({
    queryKey: ['movie', id, 'watch-providers', providerRegion],
    queryFn: () => fetchMovieWatchProviders(id, providerRegion),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
  });

  const cast = useMemo(() => Array.isArray(castData) ? castData : [], [castData]);
  const loading = isMovieLoading || isTrailerLoading || isCastLoading;
  const error = movieError;
  const watchProviderSections = useMemo(() => {
    const providers = watchProvidersData?.providers;

    if (!providers) {
      return [];
    }

    return PROVIDER_DISPLAY_ORDER
      .map((category) => ({
        category,
        label: PROVIDER_CATEGORY_LABELS[category],
        providers: Array.isArray(providers[category]) ? providers[category] : [],
      }))
      .filter((section) => section.providers.length > 0);
  }, [watchProvidersData]);
  const watchProvidersLink = watchProvidersData?.link ?? null;
  
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  useEffect(() => {
    const checkScroll = () => {
      if (castRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = castRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };
    
    const element = castRef.current;
    if (element) {
      checkScroll();
      element.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        element.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [cast]);

  const handleScroll = (direction) => {
    const element = castRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  const handleMouseDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const currentRef = castRef.current;
    if (!currentRef) return;
    const initialScrollLeft = currentRef.scrollLeft;

    const handleMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - startX;
      if (castRef.current) {
        castRef.current.scrollLeft = initialScrollLeft - x;
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (castRef.current) {
        castRef.current.style.cursor = 'grab';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    currentRef.style.cursor = 'grabbing';
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error.message || 'Erro ao carregar os detalhes do filme.'} />;
  if (!movie) return null;

  const officialReleaseDateValue = normalizeDateValue(movie.release_date);
  const brazilReleaseDateValue = getRegionReleaseDate(movie.release_dates, BRAZIL_REGION_CODE);
  const primaryReleaseDateValue = brazilReleaseDateValue || officialReleaseDateValue;
  const releaseDate = formatDateForDisplay(primaryReleaseDateValue);
  const officialReleaseDate = formatDateForDisplay(officialReleaseDateValue);
  const hasDifferentBrazilReleaseDate = Boolean(
    brazilReleaseDateValue &&
    officialReleaseDateValue &&
    brazilReleaseDateValue !== officialReleaseDateValue
  );
  const primaryReleaseLabel = brazilReleaseDateValue ? 'Lançamento no Brasil' : 'Lançamento oficial';
  const releaseYear = primaryReleaseDateValue
    ? new Date(`${primaryReleaseDateValue}T00:00:00`).getFullYear()
    : null;
  const hasVoteAverage = Number.isFinite(Number(movie.vote_average)) && Number(movie.vote_average) > 0;
  const voteAverage = hasVoteAverage ? Number(movie.vote_average).toFixed(1) : 'N/A';
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}min` : null;

  const seoImage = movie.poster_path
    ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
    : movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : undefined;
  const seoUrl = `/movie/${movie.id}`;
  const seoDescription = movie.overview?.trim() || 'Descubra detalhes completos deste título na TelaViva.';

  const seoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: seoDescription,
    image: seoImage,
    datePublished: officialReleaseDateValue || undefined,
    genre: movie.genres?.map((genre) => genre.name) || undefined,
  };

  if (hasVoteAverage) {
    seoJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(movie.vote_average).toFixed(1),
      bestRating: '10',
      ratingCount: movie.vote_count ?? 0,
    };
  }

  if (trailer) {
    seoJsonLd.trailer = {
      '@type': 'VideoObject',
      name: `${movie.title} Trailer`,
      embedUrl: `https://www.youtube.com/embed/${trailer.key}`,
      description: `Trailer oficial de ${movie.title}`,
      uploadDate: officialReleaseDateValue || undefined,
    };
  }

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

  const handleBackNavigation = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  return (
    <>
      <PageSEO
        title={movie.title}
        description={seoDescription}
        image={seoImage}
        url={seoUrl}
        type="video.movie"
        jsonLd={seoJsonLd}
      />
      
      <div className="relative min-h-screen bg-black text-white">
        <div className="relative h-[40vh] md:h-[50vh] lg:h-[70vh] overflow-hidden">
          {movie.backdrop_path ? (
            <>
              <img
                src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent hidden md:block" />
              <div className="pointer-events-none absolute -left-10 bottom-10 h-36 w-36 rounded-full bg-tv-accent/20 blur-3xl" />
              <div className="pointer-events-none absolute right-16 top-10 h-44 w-44 rounded-full bg-red-900/25 blur-3xl" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-black" />
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl uppercase tracking-[0.03em] mb-2 md:mb-3 drop-shadow-2xl leading-[0.92]">
                {movie.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-200">
                {releaseYear && (
                  <span className="flex items-center gap-1.5">
                    <FaCalendar className="text-tv-accent" size={11} />
                    {releaseYear}
                  </span>
                )}
                {runtime && (
                  <span className="flex items-center gap-1.5">
                    <FaClock className="text-tv-accent" size={11} />
                    {runtime}
                  </span>
                )}
                {hasVoteAverage && (
                  <span className="flex items-center gap-1.5">
                    <FaStar className="text-yellow-500" size={11} />
                    {voteAverage}
                  </span>
                )}
              </div>

              {movie.tagline ? (
                <p className="mt-3 max-w-2xl text-sm italic text-gray-200/90 md:text-base">
                  "{movie.tagline}"
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 relative z-10">
          
          <div className="lg:hidden mb-6 flex gap-3">
            <button
              type="button"
              onClick={handleToggleWatched}
              aria-label={
                isWatched
                  ? 'Marcar como não assistido no mobile'
                  : 'Marcar como assistido no mobile'
              }
              className={`flex-1 ${
                isWatched
                  ? ACTION_BUTTON_SUCCESS_CLASS
                  : ACTION_BUTTON_PRIMARY_CLASS
              }`}
            >
              {isWatched ? <FaCheck size={14} /> : <FaPlus size={14} />}
              {isWatched ? 'Assistido' : 'Marcar'}
            </button>
            
            <button
              type="button"
              onClick={handleToggleToWatch}
              aria-label={
                isToWatch
                  ? 'Remover da lista para assistir no mobile'
                  : 'Adicionar a lista para assistir no mobile'
              }
              className={`flex-1 ${
                isToWatch
                  ? ACTION_BUTTON_ACTIVE_CLASS
                  : ACTION_BUTTON_NEUTRAL_CLASS
              }`}
            >
              {isToWatch ? <FaCheck size={14} /> : <FaPlus size={14} />}
              {isToWatch ? 'Na Lista' : 'Ver Depois'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            
            <div className="hidden lg:block lg:col-span-3">
              <div className="lg:sticky lg:top-24">
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="mb-4 w-full rounded-2xl shadow-2xl shadow-black/55"
                  />
                ) : (
                  <div className="mb-4 flex w-full aspect-[2/3] items-center justify-center rounded-2xl bg-neutral-800">
                    <span className="text-gray-400 text-sm">Sem poster</span>
                  </div>
                )}

                <div className="mb-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      isWatched
                        ? 'border-neutral-300/60 bg-neutral-100 text-neutral-900'
                        : 'border-neutral-700 bg-neutral-900/80 text-gray-300'
                    }`}
                  >
                    {isWatched ? 'Assistido' : 'Não assistido'}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleToggleWatched}
                    aria-label={
                      isWatched ? 'Remover dos assistidos' : 'Adicionar aos assistidos'
                    }
                    className={`w-full ${
                      isWatched
                        ? ACTION_BUTTON_SUCCESS_CLASS
                        : ACTION_BUTTON_PRIMARY_CLASS
                    }`}
                  >
                    {isWatched ? <FaCheck size={16} /> : <FaPlus size={16} />}
                    {isWatched ? 'Assistido' : 'Marcar como Assistido'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleToggleToWatch}
                    aria-label={
                      isToWatch
                        ? 'Remover da lista para assistir'
                        : 'Adicionar à lista para assistir'
                    }
                    className={`w-full ${
                      isToWatch
                        ? ACTION_BUTTON_ACTIVE_CLASS
                        : ACTION_BUTTON_NEUTRAL_CLASS
                    }`}
                  >
                    {isToWatch ? <FaCheck size={16} /> : <FaPlus size={16} />}
                    {isToWatch ? 'Na Lista' : 'Adicionar à Lista'}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-9 space-y-4 md:space-y-6">
              
              {trailer && (
                <div className="relative">
                  <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-2xl shadow-black/60">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube.com/embed/${trailer.key}`}
                      title="Trailer"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}

              {movie.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {movie.genres.map((genre) => (
                    <span
                      key={genre.id}
                      className="rounded-full border border-neutral-700 bg-neutral-900/85 px-3 py-1.5 text-xs font-medium text-gray-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-tv-accent/70 hover:bg-neutral-800 hover:text-white md:px-4 md:text-sm"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              <div className={SECTION_CARD_CLASS}>
                <h2 className="mb-3 text-xl font-bold text-white md:mb-4 md:text-2xl lg:text-3xl">Sinopse</h2>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base lg:text-lg">
                  {movie.overview || 'Sinopse não disponível.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
                <div className={STAT_CARD_CLASS}>
                  <p className="text-gray-400 text-xs md:text-sm mb-1">{primaryReleaseLabel}</p>
                  <p className="text-white font-semibold text-xs md:text-base">{releaseDate}</p>
                </div>

                {hasDifferentBrazilReleaseDate && (
                  <div className={STAT_CARD_CLASS}>
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Lançamento oficial</p>
                    <p className="text-white font-semibold text-xs md:text-base">{officialReleaseDate}</p>
                  </div>
                )}
                
                {hasVoteAverage && (
                  <div className={STAT_CARD_CLASS}>
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Avaliação</p>
                    <div className="flex items-center justify-center gap-1 md:gap-2">
                      <FaStar className="text-yellow-500" size={14} />
                      <span className="text-white font-semibold text-xs md:text-lg">{voteAverage}/10</span>
                    </div>
                  </div>
                )}

                {runtime && (
                  <div className={STAT_CARD_CLASS}>
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Duração</p>
                    <p className="text-white font-semibold text-xs md:text-base">{runtime}</p>
                  </div>
                )}
              </div>

              <div className={SECTION_CARD_CLASS}>
                <div className="mb-4 md:mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">Onde Assistir</h2>
                  </div>
                </div>

                {watchProvidersLink ? (
                  <p className="mb-4 text-xs text-gray-400 md:text-sm">
                    Clique em uma plataforma para abrir os links oficiais de exibição no TMDB.
                  </p>
                ) : null}

                {isWatchProvidersLoading ? (
                  <p className="text-sm text-gray-400">Buscando provedores de streaming...</p>
                ) : watchProviderSections.length > 0 ? (
                  <div className="space-y-4">
                    {watchProviderSections.map((section) => (
                      <div key={section.category}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 md:text-sm">
                          {section.label}
                        </p>
                        <div className="flex flex-wrap gap-2 md:gap-3">
                          {section.providers.map((provider) => {
                            if (watchProvidersLink) {
                              return (
                                <a
                                  key={provider.provider_id}
                                  href={watchProvidersLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Abrir ${provider.provider_name} para assistir no TMDB`}
                                  className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/55 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors duration-200 hover:border-neutral-700 hover:bg-neutral-800/65 hover:text-gray-200 md:text-sm"
                                >
                                  {provider.logo_path ? (
                                    <img
                                      src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                      alt={provider.provider_name}
                                      className="h-5 w-5 rounded-full object-cover"
                                    />
                                  ) : null}
                                  {provider.provider_name}
                                </a>
                              );
                            }

                            return (
                              <span
                                key={provider.provider_id}
                                className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/55 px-3 py-1.5 text-xs font-medium text-gray-300 md:text-sm"
                              >
                                {provider.logo_path ? (
                                  <img
                                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                    alt={provider.provider_name}
                                    className="h-5 w-5 rounded-full object-cover"
                                  />
                                ) : null}
                                {provider.provider_name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 md:text-base">
                    Nenhum provedor disponível para a região {watchProvidersData?.region || providerRegion}.
                  </p>
                )}
              </div>

              <div className={SECTION_CARD_CLASS}>
                <h2 className="mb-4 text-xl font-bold text-white md:mb-6 md:text-2xl lg:text-3xl">Elenco Principal</h2>
                {cast.length > 0 ? (
                  <div className="relative">
                    {canScrollLeft && (
                      <button
                        type="button"
                        onClick={() => handleScroll('left')}
                        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 z-10 w-12 h-12 items-center justify-center bg-tv-accent text-white rounded-full hover:bg-tv-accent-hover shadow-xl transition-all duration-200"
                        aria-label="Scroll para a esquerda"
                      >
                        <FaChevronLeft size={18} />
                      </button>
                    )}
                    
                    <div
                      ref={castRef}
                      className="flex overflow-x-auto gap-3 md:gap-4 pb-4 scrollbar-hide cursor-grab active:cursor-grabbing"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      onMouseDown={handleMouseDown}
                    >
                      {cast.map((actor) => (
                        <div 
                          key={actor.id} 
                          className="flex-shrink-0 w-28 md:w-32 lg:w-40 group"
                        >
                          <div className="relative overflow-hidden rounded-lg mb-2 md:mb-3 shadow-lg transition-transform duration-200 group-hover:scale-105">
                            {actor.profile_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                                alt={actor.name}
                                className="w-full aspect-[2/3] object-cover"
                                onMouseDown={(event) => event.preventDefault()}
                              />
                            ) : (
                              <div className="w-full aspect-[2/3] bg-neutral-800 flex items-center justify-center">
                                <span className="text-3xl md:text-4xl">👤</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-xs md:text-sm font-semibold line-clamp-2 text-center mb-0.5 md:mb-1">
                            {actor.name}
                          </p>
                          {actor.character && (
                            <p className="text-[10px] md:text-xs text-gray-400 line-clamp-1 text-center">
                              {actor.character}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {canScrollRight && (
                      <button
                        type="button"
                        onClick={() => handleScroll('right')}
                        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 z-10 w-12 h-12 items-center justify-center bg-tv-accent text-white rounded-full hover:bg-tv-accent-hover shadow-xl transition-all duration-200"
                        aria-label="Scroll para a direita"
                      >
                        <FaChevronRight size={18} />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">Elenco não disponível.</p>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-2 md:pt-4">
                <button
                  type="button"
                  onClick={handleBackNavigation}
                  className={NAV_PRIMARY_BUTTON_CLASS}
                >
                  <FaChevronLeft size={12} />
                  Voltar
                </button>

                <Link
                  to="/"
                  className={NAV_SECONDARY_BUTTON_CLASS}
                >
                  <FaHome size={12} />
                  Ir para Início
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MovieDetails;