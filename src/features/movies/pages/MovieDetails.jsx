import React, { useContext, useRef, useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchMovieDetails,
  fetchMovieTrailer,
  fetchMovieCast,
} from '../api';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import { MovieContext } from '../context/MovieContext';
import PageSEO from '../../../components/seo/PageSEO';
import { FaCheck, FaPlus, FaClock, FaStar, FaCalendar, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const MovieDetails = () => {
  const { id } = useParams();
  const {
    addToWatched,
    addToToWatch,
    watchedMovies,
    toWatchMovies,
    removeFromWatched,
    removeFromToWatch,
  } = useContext(MovieContext);
  const castRef = useRef(null);

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

  const cast = useMemo(() => Array.isArray(castData) ? castData : [], [castData]);
  const loading = isMovieLoading || isTrailerLoading || isCastLoading;
  const error = movieError;
  
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

  const releaseDate = movie.release_date
    ? new Date(movie.release_date).toLocaleDateString('pt-BR')
    : 'Data não disponível';
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
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
    datePublished: movie.release_date || undefined,
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
      uploadDate: movie.release_date || undefined,
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
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-black" />
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold mb-2 md:mb-3 drop-shadow-2xl leading-tight">
                {movie.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-base text-gray-200">
                {releaseYear && (
                  <span className="flex items-center gap-1 md:gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md md:bg-transparent md:backdrop-blur-none md:px-0 md:py-0">
                    <FaCalendar className="text-tv-accent" size={12} />
                    {releaseYear}
                  </span>
                )}
                {runtime && (
                  <span className="flex items-center gap-1 md:gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md md:bg-transparent md:backdrop-blur-none md:px-0 md:py-0">
                    <FaClock className="text-tv-accent" size={12} />
                    {runtime}
                  </span>
                )}
                {hasVoteAverage && (
                  <span className="flex items-center gap-1 md:gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md md:bg-transparent md:backdrop-blur-none md:px-0 md:py-0">
                    <FaStar className="text-yellow-500" size={12} />
                    {voteAverage}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 relative z-10">
          
          <div className="lg:hidden mb-6 flex gap-3">
            <button
              type="button"
              onClick={handleToggleWatched}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                isWatched
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-tv-accent text-white hover:bg-tv-accent-hover shadow-lg shadow-tv-accent/30'
              }`}
            >
              {isWatched ? <FaCheck size={14} /> : <FaPlus size={14} />}
              {isWatched ? 'Assistido' : 'Assistido'}
            </button>
            
            <button
              type="button"
              onClick={handleToggleToWatch}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                isToWatch
                  ? 'bg-neutral-700 text-white hover:bg-neutral-600 border-2 border-white'
                  : 'bg-neutral-800 text-white hover:bg-neutral-700 border-2 border-neutral-700'
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
                    className="w-full rounded-xl shadow-2xl shadow-black/50 mb-4"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-neutral-800 rounded-xl flex items-center justify-center mb-4">
                    <span className="text-gray-400 text-sm">Sem poster</span>
                  </div>
                )}
                
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleToggleWatched}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      isWatched
                        ? 'bg-white text-black hover:bg-gray-200'
                        : 'bg-tv-accent text-white hover:bg-tv-accent-hover shadow-lg shadow-tv-accent/30'
                    }`}
                  >
                    {isWatched ? <FaCheck size={16} /> : <FaPlus size={16} />}
                    {isWatched ? 'Assistido' : 'Marcar como Assistido'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleToggleToWatch}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      isToWatch
                        ? 'bg-neutral-700 text-white hover:bg-neutral-600 border-2 border-white'
                        : 'bg-neutral-800 text-white hover:bg-neutral-700 border-2 border-neutral-700'
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
                <div className="relative group">
                  <div className="aspect-video w-full overflow-hidden rounded-lg md:rounded-xl shadow-2xl shadow-black/50">
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
                      className="px-3 md:px-4 py-1 md:py-1.5 bg-neutral-800/80 backdrop-blur-sm border border-neutral-700 hover:border-tv-accent text-white rounded-full text-xs md:text-sm font-medium transition-colors"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="bg-neutral-900/50 backdrop-blur-sm rounded-lg md:rounded-xl p-4 md:p-6 lg:p-8 border border-neutral-800">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-3 md:mb-4 text-tv-accent">Sinopse</h2>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base lg:text-lg">
                  {movie.overview || 'Sinopse não disponível.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 md:gap-4">
                <div className="bg-neutral-900/50 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-neutral-800 text-center">
                  <p className="text-gray-400 text-xs md:text-sm mb-1">Lançamento</p>
                  <p className="text-white font-semibold text-xs md:text-base">{releaseDate}</p>
                </div>
                
                {hasVoteAverage && (
                  <div className="bg-neutral-900/50 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-neutral-800 text-center">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Avaliação</p>
                    <div className="flex items-center justify-center gap-1 md:gap-2">
                      <FaStar className="text-yellow-500" size={14} />
                      <span className="text-white font-semibold text-xs md:text-lg">{voteAverage}/10</span>
                    </div>
                  </div>
                )}

                {runtime && (
                  <div className="bg-neutral-900/50 backdrop-blur-sm rounded-lg md:rounded-xl p-3 md:p-4 border border-neutral-800 text-center">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">Duração</p>
                    <p className="text-white font-semibold text-xs md:text-base">{runtime}</p>
                  </div>
                )}
              </div>

              <div className="bg-neutral-900/50 backdrop-blur-sm rounded-lg md:rounded-xl p-4 md:p-6 lg:p-8 border border-neutral-800">
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4 md:mb-6 text-tv-accent">Elenco Principal</h2>
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

              <div className="flex justify-center pt-2 md:pt-4">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white py-2.5 md:py-3 px-6 md:px-8 rounded-lg transition-all duration-200 font-medium border border-neutral-700 hover:border-neutral-600 text-sm md:text-base"
                >
                  <FaChevronLeft size={12} />
                  Voltar para Início
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