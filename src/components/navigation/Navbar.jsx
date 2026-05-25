import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaBars,
  FaTimes,
  FaSearch,
  FaFire,
  FaPlayCircle,
  FaClock,
  FaChartLine,
  FaStar,
  FaCompass,
  FaTags,
  FaCheckCircle,
  FaBookmark,
  FaHome,
  FaChevronRight,
} from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { fetchMoviesBySearch } from '../../features/movies/api';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import Logo from '../logo/Logo';

const NAV_LINKS = [
  { path: '/trending-movies', label: 'Tendências' },
  { path: '/now-playing-movies', label: 'Em Cartaz' },
  { path: '/upcoming-movies', label: 'Em Breve' },
  { path: '/popular-movies', label: 'Populares' },
  { path: '/top-rated-movies', label: 'Alta Avaliação' },
  { path: '/discover', label: 'Descobrir' },
  { path: '/genres', label: 'Gêneros' },
  { path: '/watched-movies', label: 'Assistidos' },
  { path: '/to-watch-movies', label: 'Ver Depois' },
];

const MOBILE_MENU_GROUPS = [
  {
    title: 'Explorar',
    paths: [
      '/trending-movies',
      '/now-playing-movies',
      '/upcoming-movies',
      '/popular-movies',
      '/top-rated-movies',
      '/discover',
      '/genres',
    ],
  },
  {
    title: 'Minha Biblioteca',
    paths: ['/watched-movies', '/to-watch-movies'],
  },
];

const MOBILE_LINK_META = {
  '/trending-movies': {
    icon: FaFire,
    description: 'Filmes em alta agora',
  },
  '/now-playing-movies': {
    icon: FaPlayCircle,
    description: 'O que está em cartaz',
  },
  '/upcoming-movies': {
    icon: FaClock,
    description: 'Próximas estreias',
  },
  '/popular-movies': {
    icon: FaChartLine,
    description: 'Mais populares da comunidade',
  },
  '/top-rated-movies': {
    icon: FaStar,
    description: 'Melhores avaliações',
  },
  '/discover': {
    icon: FaCompass,
    description: 'Descubra por filtros avançados',
  },
  '/genres': {
    icon: FaTags,
    description: 'Explore por gênero',
  },
  '/watched-movies': {
    icon: FaCheckCircle,
    description: 'Seus filmes assistidos',
  },
  '/to-watch-movies': {
    icon: FaBookmark,
    description: 'Sua lista para ver depois',
  },
};

const formatReleaseYear = (releaseDate) => {
  if (!releaseDate) {
    return 'N/A';
  }

  const year = new Date(releaseDate).getFullYear();
  return Number.isFinite(year) ? String(year) : 'N/A';
};

const formatVoteAverage = (voteAverage) => {
  const vote = Number(voteAverage);
  if (!Number.isFinite(vote) || vote <= 0) {
    return null;
  }

  return vote.toFixed(1);
};

const escapeRegexPattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightTitleMatch = (title, query) => {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeQuery = typeof query === 'string' ? query.trim() : '';

  if (!safeTitle || !safeQuery) {
    return safeTitle;
  }

  const escapedQuery = escapeRegexPattern(safeQuery);
  if (!escapedQuery) {
    return safeTitle;
  }

  const queryRegex = new RegExp(`(${escapedQuery})`, 'ig');
  const parts = safeTitle.split(queryRegex);

  if (parts.length <= 1) {
    return safeTitle;
  }

  const normalizedQuery = safeQuery.toLowerCase();

  return parts.map((part, index) => {
    if (part.toLowerCase() === normalizedQuery) {
      return (
        <mark
          key={`mark-${part}-${index}`}
          className="bg-transparent text-tv-accent font-semibold"
        >
          {part}
        </mark>
      );
    }

    return <React.Fragment key={`text-${part}-${index}`}>{part}</React.Fragment>;
  });
};

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDesktopSearchActive, setIsDesktopSearchActive] = useState(false);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isScrolled, setIsScrolled] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const desktopSearchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const desktopSearchWrapperRef = useRef(null);
  const mobileSearchWrapperRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const desktopNavRef = useRef(null);
  const desktopNavLinksRef = useRef({});

  const [desktopActiveIndicator, setDesktopActiveIndicator] = useState({
    x: 0,
    width: 0,
    opacity: 0,
  });

  const debouncedQuery = useDebouncedValue(searchQuery, 400);
  const trimmedSearchQuery = searchQuery.trim();
  const trimmedDebouncedQuery = debouncedQuery.trim();
  const isSearchActive = isDesktopSearchActive || isMobileSearchActive;
  const hasMinimumQuery = trimmedSearchQuery.length >= 2;
  const isDebouncing = hasMinimumQuery && trimmedDebouncedQuery !== trimmedSearchQuery;

  const { data: searchData, isFetching: isSearching, isError: hasSearchError } = useQuery({
    queryKey: ['search', 'navbar', trimmedDebouncedQuery],
    queryFn: () => fetchMoviesBySearch(trimmedDebouncedQuery, 1),
    enabled: trimmedDebouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const searchResults = searchData?.results ?? [];
  const totalResults = searchData?.totalResults ?? searchResults.length;
  const hasResults = searchResults.length > 0;
  const shouldShowDropdown = showSuggestions && isSearchActive && trimmedSearchQuery.length > 0;
  const activeDesktopNavPath = NAV_LINKS.find(({ path }) => location.pathname === path)?.path ?? null;

  const activeSuggestion =
    activeSuggestionIndex >= 0 ? searchResults[activeSuggestionIndex] : null;
  const activeSuggestionId = activeSuggestion
    ? `navbar-search-option-${activeSuggestion.id}`
    : undefined;

  const runOnNextFrame = (callback) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(callback);
      return;
    }

    setTimeout(callback, 0);
  };

  const closeSearchPanels = ({ clearQuery = false } = {}) => {
    setIsDesktopSearchActive(false);
    setIsMobileSearchActive(false);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    if (clearQuery) {
      setSearchQuery('');
    }
  };

  const openDesktopSearch = () => {
    setMenuOpen(false);
    setIsMobileSearchActive(false);
    setIsDesktopSearchActive(true);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
    runOnNextFrame(() => {
      desktopSearchInputRef.current?.focus();
    });
  };

  const openMobileSearch = () => {
    setMenuOpen(false);
    setIsDesktopSearchActive(false);
    setIsMobileSearchActive(true);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
    runOnNextFrame(() => {
      mobileSearchInputRef.current?.focus();
    });
  };

  const closeDesktopSearch = ({ clearQuery = false } = {}) => {
    setIsDesktopSearchActive(false);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    if (clearQuery) {
      setSearchQuery('');
    }
  };

  const closeMobileSearch = ({ clearQuery = false } = {}) => {
    setIsMobileSearchActive(false);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    if (clearQuery) {
      setSearchQuery('');
    }
  };

  const toggleMenu = () => {
    setMenuOpen((state) => {
      const nextState = !state;

      if (nextState) {
        closeSearchPanels();
      }

      return nextState;
    });
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
  };

  const handleSearchSubmit = () => {
    if (!trimmedSearchQuery) {
      return;
    }

    const query = trimmedSearchQuery;
    runOnNextFrame(() => {
      navigate(`/search-results?query=${encodeURIComponent(query)}`);
    });

    setMenuOpen(false);
    closeSearchPanels({ clearQuery: true });
  };

  const handleSuggestionSelect = (movie) => {
    if (!movie?.id) {
      return;
    }

    runOnNextFrame(() => {
      navigate(`/movie/${movie.id}`);
    });

    setMenuOpen(false);
    closeSearchPanels({ clearQuery: true });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);

    runOnNextFrame(() => {
      if (isMobileSearchActive) {
        mobileSearchInputRef.current?.focus();
        return;
      }

      desktopSearchInputRef.current?.focus();
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();

      if (trimmedSearchQuery) {
        handleClearSearch();
        return;
      }

      if (isMobileSearchActive) {
        closeMobileSearch();
      } else if (isDesktopSearchActive) {
        closeDesktopSearch();
      }

      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!shouldShowDropdown || !hasMinimumQuery || !hasResults || isDebouncing || isSearching) {
        return;
      }

      event.preventDefault();

      setActiveSuggestionIndex((currentIndex) => {
        if (event.key === 'ArrowDown') {
          return currentIndex < searchResults.length - 1 ? currentIndex + 1 : 0;
        }

        return currentIndex > 0 ? currentIndex - 1 : searchResults.length - 1;
      });

      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (shouldShowDropdown && activeSuggestionIndex >= 0 && activeSuggestionIndex < searchResults.length) {
        handleSuggestionSelect(searchResults[activeSuggestionIndex]);
        return;
      }

      handleSearchSubmit();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const isModalOpen = menuOpen || isMobileSearchActive;

    if (isModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [menuOpen, isMobileSearchActive]);

  useEffect(() => {
    const trapContainer = menuOpen
      ? mobileMenuRef.current
      : isMobileSearchActive
      ? mobileSearchWrapperRef.current
      : null;
    if (!trapContainer) return;

    const lastFocused = document.activeElement;
    const focusableElements = trapContainer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    if (menuOpen) {
      firstElement?.focus();
    }

    if (isMobileSearchActive) {
      mobileSearchInputRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      lastFocused?.focus();
    };
  }, [menuOpen, isMobileSearchActive]);

  useEffect(() => {
    if (!isDesktopSearchActive) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (!desktopSearchWrapperRef.current) {
        return;
      }

      if (!desktopSearchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);

        if (!trimmedSearchQuery) {
          setIsDesktopSearchActive(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDesktopSearchActive, trimmedSearchQuery]);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [trimmedSearchQuery, trimmedDebouncedQuery]);

  useEffect(() => {
    const updateDesktopActiveIndicator = () => {
      if (!desktopNavRef.current || !activeDesktopNavPath) {
        setDesktopActiveIndicator((previous) =>
          previous.opacity === 0
            ? previous
            : {
                ...previous,
                opacity: 0,
              }
        );
        return;
      }

      const activeLinkElement = desktopNavLinksRef.current[activeDesktopNavPath];
      if (!activeLinkElement) {
        setDesktopActiveIndicator((previous) =>
          previous.opacity === 0
            ? previous
            : {
                ...previous,
                opacity: 0,
              }
        );
        return;
      }

      const navRect = desktopNavRef.current.getBoundingClientRect();
      const activeLinkRect = activeLinkElement.getBoundingClientRect();

      const nextIndicator = {
        x: activeLinkRect.left - navRect.left,
        width: activeLinkRect.width,
        opacity: 1,
      };

      setDesktopActiveIndicator((previous) => {
        const hasChanged =
          Math.abs(previous.x - nextIndicator.x) > 0.5 ||
          Math.abs(previous.width - nextIndicator.width) > 0.5 ||
          previous.opacity !== nextIndicator.opacity;

        return hasChanged ? nextIndicator : previous;
      });
    };

    updateDesktopActiveIndicator();

    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      updateDesktopActiveIndicator();
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver;
    if (typeof ResizeObserver === 'function' && desktopNavRef.current) {
      resizeObserver = new ResizeObserver(updateDesktopActiveIndicator);
      resizeObserver.observe(desktopNavRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [activeDesktopNavPath, isDesktopSearchActive]);

  const isActiveLink = (path) => location.pathname === path;

  const renderSearchResult = (movie, index) => {
    const isMobileDropdown = isMobileSearchActive;
    const isFocusedSuggestion = activeSuggestionIndex === index;
    const voteAverage = formatVoteAverage(movie.vote_average);
    const highlightedTitle = highlightTitleMatch(movie.title, trimmedSearchQuery);

    return (
    <Link
      key={movie.id}
      id={`navbar-search-option-${movie.id}`}
      to={`/movie/${movie.id}`}
      role="option"
      aria-selected={isFocusedSuggestion ? 'true' : 'false'}
      onClick={() => {
        setMenuOpen(false);
        closeSearchPanels({ clearQuery: true });
      }}
      onMouseEnter={() => setActiveSuggestionIndex(index)}
      onFocus={() => setActiveSuggestionIndex(index)}
      className={`flex w-full items-center text-left transition-colors border-b last:border-b-0 ${
        isMobileDropdown
          ? `gap-2.5 px-3 py-2 border-neutral-800 ${
              isFocusedSuggestion ? 'bg-neutral-800/85' : 'hover:bg-neutral-800/70'
            }`
          : `gap-3 p-3 border-neutral-700 ${isFocusedSuggestion ? 'bg-neutral-800' : 'hover:bg-neutral-800'}`
      }`}
    >
      {movie.poster_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
          alt={movie.title}
          className={`flex-shrink-0 rounded object-cover ${
            isMobileDropdown ? 'h-12 w-8' : 'h-16 w-12'
          }`}
        />
      ) : (
        <span
          className={`flex-shrink-0 rounded bg-neutral-700 text-[10px] text-gray-300 flex items-center justify-center text-center px-1 ${
            isMobileDropdown ? 'h-12 w-8' : 'h-16 w-12'
          }`}
        >
          Sem imagem
        </span>
      )}
      <span className="flex-1 flex flex-col">
        <span className={`text-white font-semibold leading-tight line-clamp-1 ${isMobileDropdown ? 'text-xs' : 'text-sm'}`}>
          {highlightedTitle}
        </span>
        <span className={`text-gray-400 ${isMobileDropdown ? 'text-[11px]' : 'text-xs'}`}>
          {formatReleaseYear(movie.release_date)}
          {voteAverage ? ` • ${voteAverage}` : ''}
        </span>
      </span>
    </Link>
    );
  };

  const renderSuggestionsContent = ({ mobile = false } = {}) => {
    const helperTextClass = mobile ? 'px-3 py-2.5 text-xs text-gray-400' : 'px-4 py-3 text-sm text-gray-400';

    if (!hasMinimumQuery) {
      return (
        <p className={helperTextClass}>
          Digite ao menos 2 caracteres para buscar.
        </p>
      );
    }

    if (isDebouncing || isSearching) {
      return <p className={helperTextClass}>Buscando...</p>;
    }

    if (hasSearchError) {
      return (
        <p className={mobile ? 'px-3 py-2.5 text-xs text-red-300' : 'px-4 py-3 text-sm text-red-300'}>
          Não foi possível buscar agora. Tente novamente em instantes.
        </p>
      );
    }

    if (!hasResults) {
      return <p className={helperTextClass}>Nenhum resultado encontrado.</p>;
    }

    return (
      <>
        {searchResults.slice(0, 5).map((movie, index) => renderSearchResult(movie, index))}
        <button
          type="button"
          onClick={handleSearchSubmit}
          className={`w-full text-center text-tv-accent hover:bg-neutral-800 transition-colors font-semibold ${
            mobile ? 'px-3 py-2 text-xs' : 'p-3 text-sm'
          }`}
        >
          Ver todos os {totalResults} resultados
        </button>
      </>
    );
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/95 backdrop-blur-md shadow-lg' : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      <div className="flex items-center justify-between h-16">
        <Link to="/" className="flex items-center flex-shrink-0 ml-2 sm:ml-4 lg:ml-6">
          <Logo size="small" showText={true} />
        </Link>

        <div className="hidden md:flex items-center gap-6 mr-2 sm:mr-4 lg:mr-6">
          <div className="relative">
            <ul ref={desktopNavRef} className="relative flex items-center space-x-6 pb-1">
              {NAV_LINKS.map(({ path, label }) => (
                <li key={path}>
                  <Link
                    ref={(node) => {
                      if (node) {
                        desktopNavLinksRef.current[path] = node;
                      } else {
                        delete desktopNavLinksRef.current[path];
                      }
                    }}
                    to={path}
                    className={`inline-flex whitespace-nowrap pb-1 text-sm font-medium transition-colors ${
                      isActiveLink(path) ? 'text-tv-accent' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-tv-accent transition-[transform,width,opacity] duration-300 ease-out"
              style={{
                width: `${desktopActiveIndicator.width}px`,
                transform: `translateX(${desktopActiveIndicator.x}px)`,
                opacity: desktopActiveIndicator.opacity,
              }}
            />
          </div>

          <div className="flex items-center gap-2" ref={desktopSearchWrapperRef}>
          <div className={`relative transition-all duration-300 ease-in-out overflow-hidden ${isDesktopSearchActive ? 'w-64' : 'w-0'}`}>
            {isDesktopSearchActive && (
              <>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  ref={desktopSearchInputRef}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-4 pr-10 py-2 rounded-full bg-neutral-800 text-white placeholder-gray-400 focus:outline-none"
                  placeholder="Pesquisar..."
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={shouldShowDropdown ? 'true' : 'false'}
                  aria-controls="navbar-search-results-desktop"
                  aria-activedescendant={activeSuggestionId}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    aria-label="Limpar busca"
                  >
                    <FaTimes size={14} />
                  </button>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (isDesktopSearchActive && trimmedSearchQuery) {
                handleSearchSubmit();
              } else if (isDesktopSearchActive) {
                closeDesktopSearch();
              } else {
                openDesktopSearch();
              }
            }}
            className="text-gray-300 hover:text-white transition-colors flex-shrink-0"
            aria-label={isDesktopSearchActive && trimmedSearchQuery ? 'Buscar' : 'Abrir pesquisa'}
          >
            <FaSearch size={20} />
          </button>
          {shouldShowDropdown && isDesktopSearchActive && (
            <div
              id="navbar-search-results-desktop"
              role="listbox"
              className="absolute top-full right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-neutral-900/95 rounded-lg shadow-2xl z-50 border border-neutral-700 backdrop-blur-sm"
            >
              {renderSuggestionsContent()}
            </div>
          )}
        </div>
        </div>

        <div className="flex md:hidden items-center gap-3 mr-2 sm:mr-4 lg:mr-6">
          <div className="relative" ref={mobileSearchWrapperRef}>
            <button
              type="button"
              onClick={() => {
                if (isMobileSearchActive && trimmedSearchQuery) {
                  handleSearchSubmit();
                  return;
                }

                if (isMobileSearchActive) {
                  closeMobileSearch();
                  return;
                }

                openMobileSearch();
              }}
              className={`flex h-9 w-9 items-center justify-center transition-colors focus:outline-none ${
                isMobileSearchActive ? 'text-tv-accent' : 'text-white hover:text-tv-accent'
              }`}
              aria-label={
                isMobileSearchActive && trimmedSearchQuery
                  ? 'Buscar'
                  : isMobileSearchActive
                  ? 'Fechar pesquisa'
                  : 'Abrir pesquisa'
              }
            >
              <FaSearch size={20} />
            </button>
            {isMobileSearchActive && (
              <>
                <div
                  className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] transition-opacity duration-200"
                  onClick={() => {
                    closeMobileSearch();
                  }}
                />
                <div className="fixed left-0 right-0 top-16 z-50 mx-auto max-w-[calc(100vw-1rem)] px-2">
                  <div className="relative w-full rounded-2xl border border-neutral-800 bg-neutral-950/95 p-3 shadow-2xl backdrop-blur-md">
                    <div className="relative">
                      <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleKeyDown}
                        ref={mobileSearchInputRef}
                        onFocus={() => setShowSuggestions(true)}
                        className="w-full rounded-xl border border-neutral-700 bg-neutral-900/80 py-2.5 pl-9 pr-10 text-sm text-white placeholder-gray-500 transition-all duration-200 focus:border-tv-accent/55 focus:outline-none focus:ring-1 focus:ring-tv-accent/40"
                        placeholder="Pesquisar filmes..."
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={shouldShowDropdown ? 'true' : 'false'}
                        aria-controls="navbar-search-results-mobile"
                        aria-activedescendant={activeSuggestionId}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (trimmedSearchQuery) {
                            handleClearSearch();
                            return;
                          }

                          closeMobileSearch();
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 transition-colors hover:bg-neutral-800 hover:text-white"
                        aria-label={trimmedSearchQuery ? 'Limpar busca' : 'Fechar busca'}
                      >
                        <FaTimes size={14} />
                      </button>
                    </div>
                    {shouldShowDropdown && (
                      <div
                        id="navbar-search-results-mobile"
                        role="listbox"
                        className="mt-2 w-full max-h-[65vh] overflow-y-auto overflow-x-hidden rounded-xl border border-neutral-800 bg-black/70"
                      >
                        {renderSuggestionsContent({ mobile: true })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Menu hamburguer */}
          <button
            type="button"
            onClick={toggleMenu}
            className="flex h-9 w-9 items-center justify-center text-white transition-colors hover:text-tv-accent focus:outline-none"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>
      </div>

      <div
        ref={mobileMenuRef}
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ease-in-out ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMenuOpen(false);
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <div
          className={`absolute inset-y-0 right-0 w-[88vw] max-w-sm transform transition-transform duration-300 ease-out ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden border-l border-neutral-700 bg-gradient-to-b from-neutral-950 via-black to-neutral-950 shadow-2xl shadow-tv-accent/10">
            <div className="border-b border-neutral-800 px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Logo size="small" showText={true} />
                  <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-gray-500">Navegação</p>
                  <p className="mt-1 text-xs text-gray-300">Acesso rápido a todas as seções</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-neutral-700 p-2 text-gray-300 transition-colors hover:border-neutral-500 hover:text-white"
                  aria-label="Fechar menu"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <FaTimes size={18} />
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openMobileSearch();
                  }}
                  className="flex h-9 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-3 text-sm font-medium text-white transition-colors hover:border-tv-accent/50 hover:bg-neutral-800"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <FaSearch size={14} />
                  Buscar
                </button>

                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex h-9 items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-3 text-sm font-medium text-white transition-colors hover:border-tv-accent/50 hover:bg-neutral-800"
                  tabIndex={menuOpen ? 0 : -1}
                >
                  <FaHome size={14} />
                  Início
                </Link>
              </div>
            </div>

            <div className="mt-2 flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-4">
                {MOBILE_MENU_GROUPS.map((group) => (
                  <section key={group.title}>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{group.title}</p>
                    <ul className="mt-2 space-y-1.5">
                      {group.paths.map((path, index) => {
                        const linkData = NAV_LINKS.find((item) => item.path === path);
                        if (!linkData) {
                          return null;
                        }

                        const linkMeta = MOBILE_LINK_META[path] ?? {};
                        const LinkIcon = linkMeta.icon ?? FaPlayCircle;
                        const isActive = isActiveLink(path);

                        return (
                          <li
                            key={path}
                            className={`transform transition-all duration-300 ease-out ${
                              menuOpen ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'
                            }`}
                            style={{ transitionDelay: `${90 + index * 28}ms` }}
                          >
                            <Link
                              to={path}
                              onClick={() => setMenuOpen(false)}
                              className={`group flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition-all duration-200 ${
                                isActive
                                  ? 'border-tv-accent/70 bg-tv-accent/10 text-tv-accent shadow-[0_0_0_1px_rgba(189,0,3,0.25)]'
                                  : 'border-neutral-800 bg-neutral-900/60 text-gray-200 hover:border-neutral-600 hover:bg-neutral-800/70 hover:text-white'
                              }`}
                              aria-current={isActive ? 'page' : undefined}
                              tabIndex={menuOpen ? 0 : -1}
                            >
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                                  isActive
                                    ? 'border-tv-accent/70 bg-tv-accent/15 text-tv-accent'
                                    : 'border-neutral-700 bg-neutral-800 text-gray-300 group-hover:text-white'
                                }`}
                              >
                                <LinkIcon size={13} />
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold leading-tight">{linkData.label}</span>
                                <span
                                  className={`mt-0.5 block text-[11px] leading-tight ${
                                    isActive ? 'text-red-200/80' : 'text-gray-400 group-hover:text-gray-300'
                                  }`}
                                >
                                  {linkMeta.description}
                                </span>
                              </span>

                              <FaChevronRight
                                size={11}
                                className={`transition-transform duration-200 ${
                                  isActive
                                    ? 'text-tv-accent'
                                    : 'text-gray-500 group-hover:translate-x-0.5 group-hover:text-gray-300'
                                }`}
                              />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;