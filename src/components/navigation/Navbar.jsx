import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import { fetchMoviesBySearch } from '../../features/movies/api';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import Logo from '../logo/Logo';

const NAV_LINKS = [
  { path: '/now-playing-movies', label: 'Em Cartaz' },
  { path: '/popular-movies', label: 'Populares' },
  { path: '/top-rated-movies', label: 'Alta Avaliação' },
  { path: '/upcoming-movies', label: 'Em Breve' },
  { path: '/watched-movies', label: 'Assistidos' },
  { path: '/to-watch-movies', label: 'Ver Depois' },
  { path: '/genres', label: 'Gêneros' },
];

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);
  const searchWrapperRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const debouncedQuery = useDebouncedValue(searchQuery, 400);

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['search', 'navbar', debouncedQuery],
    queryFn: () => fetchMoviesBySearch(debouncedQuery, 1),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const toggleMenu = () => setMenuOpen((state) => !state);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setShowSuggestions(true);
  };

  const runOnNextFrame = (callback) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(callback);
    } else {
      setTimeout(callback, 0);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      const query = searchQuery.trim();
      runOnNextFrame(() => {
        navigate(`/search-results?query=${encodeURIComponent(query)}`);
      });
      setMenuOpen(false);
      setShowSuggestions(false);
      setIsSearchActive(false);
      setSearchQuery('');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
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
    const isModalOpen = menuOpen || isSearchActive;
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
  }, [menuOpen, isSearchActive]);

  useEffect(() => {
    const trapContainer = menuOpen
      ? mobileMenuRef.current
      : isSearchActive
      ? searchWrapperRef.current
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

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      lastFocused?.focus();
    };
  }, [menuOpen, isSearchActive]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedOnResult = event.target.closest('a[href^="/movie/"]');
      
      if (clickedOnResult) {
        return;
      }
      
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
        if (!searchQuery.trim()) {
          setIsSearchActive(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchQuery]);

  const isActiveLink = (path) => location.pathname === path;

  const searchResults = searchData?.results ?? [];
  const totalResults = searchData?.totalResults ?? searchResults.length;
  const hasResults = searchResults.length > 0;
  const shouldShowDropdown =
    showSuggestions && searchQuery.trim().length >= 2 && (isSearching || searchData);

  const renderSearchResult = (movie) => (
    <Link
      key={movie.id}
      to={`/movie/${movie.id}`}
      onClick={() => {
        setMenuOpen(false);
        setShowSuggestions(false);
        setIsSearchActive(false);
        setSearchQuery('');
      }}
      className="flex w-full items-center gap-3 p-3 text-left transition-colors border-b border-neutral-700 last:border-b-0 hover:bg-neutral-800"
    >
      {movie.poster_path ? (
        <img
          src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
          alt={movie.title}
          className="h-16 w-12 flex-shrink-0 rounded object-cover"
        />
      ) : (
        <span className="h-16 w-12 flex-shrink-0 rounded bg-neutral-700 text-[10px] text-gray-300 flex items-center justify-center text-center px-1">
          Sem imagem
        </span>
      )}
      <span className="flex-1 flex flex-col">
        <span className="text-white text-sm font-semibold leading-tight line-clamp-1">{movie.title}</span>
        <span className="text-gray-400 text-xs">{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
      </span>
    </Link>
  );

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
          <ul className="flex items-center space-x-6">
            {NAV_LINKS.map(({ path, label }) => (
              <li key={path}>
                <Link
                  to={path}
                  className={`text-sm font-medium transition-colors whitespace-nowrap ${
                    isActiveLink(path) ? 'text-tv-accent' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2" ref={searchWrapperRef}>
          <div className={`relative transition-all duration-300 ease-in-out overflow-hidden ${isSearchActive ? 'w-64' : 'w-0'}`}>
            {isSearchActive && (
              <>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  ref={searchInputRef}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-4 pr-10 py-2 rounded-full bg-neutral-800 text-white placeholder-gray-400 focus:outline-none"
                  placeholder="Pesquisar..."
                  role="combobox"
                  aria-expanded={shouldShowDropdown ? 'true' : 'false'}
                  aria-controls="navbar-search-results"
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
              if (isSearchActive && searchQuery.trim()) {
                handleSearchSubmit();
              } else {
                setIsSearchActive(!isSearchActive);
              }
            }}
            className="text-gray-300 hover:text-white transition-colors flex-shrink-0"
            aria-label={isSearchActive && searchQuery.trim() ? "Buscar" : "Abrir pesquisa"}
          >
            <FaSearch size={20} />
          </button>
          {shouldShowDropdown && isSearchActive && (
            <div
              id="navbar-search-results"
              role="listbox"
              className="absolute top-full right-0 mt-2 w-96 max-h-96 overflow-y-auto bg-neutral-900 rounded-lg shadow-2xl z-50 border border-neutral-700"
            >
              {isSearching ? <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p> : null}
              {hasResults ? searchResults.slice(0, 5).map(renderSearchResult) : null}
              {!isSearching && !hasResults && (
                <p className="px-4 py-3 text-sm text-gray-400">Nenhum resultado encontrado.</p>
              )}
              {hasResults && totalResults > 5 && (
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full p-3 text-center text-tv-accent hover:bg-neutral-800 transition-colors text-sm font-semibold"
                >
                  Ver todos os {totalResults} resultados
                </button>
              )}
            </div>
          )}
        </div>
        </div>

        <div className="flex md:hidden items-center gap-3 mr-2 sm:mr-4 lg:mr-6">
          <div className="relative" ref={searchWrapperRef}>
            <button
              type="button"
              onClick={() => setIsSearchActive(true)}
              className="flex items-center justify-center text-white focus:outline-none h-8 w-8"
              aria-label="Abrir pesquisa"
            >
              <FaSearch size={20} />
            </button>
            {isSearchActive && (
              <>
                <div
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchQuery('');
                    setShowSuggestions(false);
                  }}
                />
                <div className="fixed left-0 right-0 top-20 px-4 z-50 animate-slideDown max-w-[calc(100vw-2rem)] mx-auto">
                  <div className="relative bg-gradient-to-r from-black/95 to-neutral-900/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-neutral-700/50 shadow-tv-accent/10 w-full">
                    <div className="relative">
                      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleKeyDown}
                        ref={searchInputRef}
                        onFocus={() => setShowSuggestions(true)}
                        className="w-full pl-10 pr-12 py-3 rounded-full bg-neutral-800/80 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tv-accent/50 transition-all duration-300 border border-neutral-600/50"
                        placeholder="Pesquisar filmes..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchActive(false);
                          setSearchQuery('');
                          setShowSuggestions(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-neutral-700/50"
                        aria-label="Fechar busca"
                      >
                        <FaTimes size={16} />
                      </button>
                    </div>
                    {shouldShowDropdown && (
                      <div
                        id="navbar-search-results-mobile"
                        role="listbox"
                        className="mt-2 w-full max-h-80 overflow-y-auto overflow-x-hidden bg-neutral-900 rounded-lg shadow-2xl border border-neutral-700"
                      >
                        {isSearching && (
                          <p className="px-4 py-3 text-sm text-gray-400">Buscando...</p>
                        )}
                        {hasResults && searchResults.slice(0, 5).map(renderSearchResult)}
                        {!isSearching && !hasResults && (
                          <p className="px-4 py-3 text-sm text-gray-400 text-center">Nenhum resultado encontrado.</p>
                        )}
                        {hasResults && totalResults > 5 && (
                          <button
                            type="button"
                            onClick={handleSearchSubmit}
                            className="w-full p-3 text-center text-tv-accent hover:bg-neutral-800 transition-colors text-sm font-semibold"
                          >
                            Ver todos os {totalResults} resultados
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Menu hamburguer */}
          <button type="button" onClick={toggleMenu} className="flex items-center justify-center text-white focus:outline-none h-8 w-8">
            {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>
      </div>

      <div
        ref={mobileMenuRef}
        className={`fixed inset-0 bg-black/95 backdrop-blur-md z-40 md:hidden transition-opacity duration-300 ease-in-out ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMenuOpen(false);
        }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center space-y-8 relative overflow-y-auto py-20">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="absolute top-6 right-6 text-white hover:text-tv-accent transition-colors p-2"
            aria-label="Fechar menu"
            tabIndex={menuOpen ? 0 : -1}
          >
            <FaTimes size={32} />
          </button>

          <ul className="flex flex-col items-center space-y-6 text-center">
            {NAV_LINKS.map(({ path, label }, index) => (
              <li
                key={path}
                className={`transform transition-all duration-300 ease-in-out ${
                  menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'
                }`}
                style={{ transitionDelay: `${150 + index * 75}ms` }}
              >
                <Link
                  to={path}
                  className={`text-2xl font-medium transition-colors ${
                    isActiveLink(path) ? 'text-tv-accent' : 'text-gray-300 hover:text-white'
                  }`}
                  onClick={() => setMenuOpen(false)}
                  tabIndex={menuOpen ? 0 : -1}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;