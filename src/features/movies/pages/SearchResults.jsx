import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import { fetchMoviesBySearch } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';
import { MovieContext } from '../context/MovieContext';

const SEARCH_SORT_OPTIONS = {
  relevance: 'Relevância da busca',
  popularityDesc: 'Popularidade (maior para menor)',
  popularityAsc: 'Popularidade (menor para maior)',
  ratingDesc: 'Nota média (maior para menor)',
  ratingAsc: 'Nota média (menor para maior)',
  newest: 'Lançamento (mais recentes)',
  oldest: 'Lançamento (mais antigos)',
};

const QUICK_SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevância' },
  { value: 'popularityDesc', label: 'Popularidade' },
  { value: 'ratingDesc', label: 'Melhor nota' },
  { value: 'newest', label: 'Mais recentes' },
];

const MIN_RATING_OPTIONS = [
  { value: '', label: 'Qualquer nota' },
  { value: '5', label: '5+' },
  { value: '6', label: '6+' },
  { value: '7', label: '7+' },
  { value: '8', label: '8+' },
  { value: '9', label: '9+' },
];

const MIN_RELEASE_YEAR = 1900;
const MAX_RELEASE_YEAR = new Date().getFullYear() + 2;
const YEAR_OPTIONS = Array.from(
  { length: MAX_RELEASE_YEAR - MIN_RELEASE_YEAR + 1 },
  (_, index) => String(MAX_RELEASE_YEAR - index)
);

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { watchedMovies, toWatchMovies } = useContext(MovieContext);
  const query = searchParams.get('query')?.trim() || '';

  const [activeQuery, setActiveQuery] = useState(query);
  const [queryDraft, setQueryDraft] = useState(query);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setActiveQuery(query);
    setQueryDraft(query);
  }, [query]);

  useEffect(() => {
    if (!isMobileFiltersOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMobileFiltersOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileFiltersOpen]);

  const filters = useMemo(() => {
    const sortBy = searchParams.get('sortBy') || 'relevance';
    return {
      year: searchParams.get('year') || '',
      minRating: searchParams.get('minRating') || '',
      sortBy: Object.prototype.hasOwnProperty.call(SEARCH_SORT_OPTIONS, sortBy) ? sortBy : 'relevance',
      excludeWatched: searchParams.get('excludeWatched') === '1',
      onlyToWatch: searchParams.get('onlyToWatch') === '1',
    };
  }, [searchParams]);

  const watchedIds = useMemo(
    () => new Set(watchedMovies.map((movie) => movie.id)),
    [watchedMovies]
  );

  const toWatchIds = useMemo(
    () => new Set(toWatchMovies.map((movie) => movie.id)),
    [toWatchMovies]
  );

  const updateSearchParams = useCallback(
    (updates) => {
      const nextSearchParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        const valueAsString = value == null ? '' : String(value);
        if (!valueAsString) {
          nextSearchParams.delete(key);
          return;
        }

        nextSearchParams.set(key, valueAsString);
      });

      if (activeQuery) {
        nextSearchParams.set('query', activeQuery);
      }

      setSearchParams(nextSearchParams);
    },
    [activeQuery, searchParams, setSearchParams]
  );

  const handleApplySearchQuery = useCallback(
    (event) => {
      event.preventDefault();

      const normalizedQuery = queryDraft.trim();
      setActiveQuery(normalizedQuery);

      const nextSearchParams = new URLSearchParams(searchParams);

      if (normalizedQuery) {
        nextSearchParams.set('query', normalizedQuery);
      } else {
        nextSearchParams.delete('query');
      }

      setSearchParams(nextSearchParams);
    },
    [queryDraft, searchParams, setSearchParams]
  );

  const handleClearQuery = useCallback(() => {
    setQueryDraft('');
    setActiveQuery('');

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('query');
    setSearchParams(nextSearchParams);
  }, [searchParams, setSearchParams]);

  const handleSelectChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      updateSearchParams({ [name]: value });
    },
    [updateSearchParams]
  );

  const handleToggleChange = useCallback(
    (event) => {
      const { name, checked } = event.target;
      updateSearchParams({ [name]: checked ? '1' : '' });
    },
    [updateSearchParams]
  );

  const handleQuickSort = useCallback(
    (sortValue) => {
      updateSearchParams({ sortBy: sortValue === 'relevance' ? '' : sortValue });
    },
    [updateSearchParams]
  );

  const handleRemoveFilter = useCallback(
    (filterKey) => {
      if (filterKey === 'year') {
        updateSearchParams({ year: '' });
        return;
      }

      if (filterKey === 'minRating') {
        updateSearchParams({ minRating: '' });
        return;
      }

      if (filterKey === 'sortBy') {
        updateSearchParams({ sortBy: '' });
        return;
      }

      if (filterKey === 'excludeWatched') {
        updateSearchParams({ excludeWatched: '' });
        return;
      }

      if (filterKey === 'onlyToWatch') {
        updateSearchParams({ onlyToWatch: '' });
      }
    },
    [updateSearchParams]
  );

  const handleReset = useCallback(() => {
    const nextSearchParams = new URLSearchParams();
    if (activeQuery) {
      nextSearchParams.set('query', activeQuery);
    }
    setSearchParams(nextSearchParams);
  }, [activeQuery, setSearchParams]);

  const activeFilters = useMemo(() => {
    const items = [];

    if (filters.year) {
      items.push({ key: 'year', label: `Ano de lançamento: ${filters.year}` });
    }

    if (filters.minRating) {
      items.push({ key: 'minRating', label: `Nota mínima: ${filters.minRating}+` });
    }

    if (filters.sortBy !== 'relevance') {
      items.push({ key: 'sortBy', label: `Ordenar por: ${SEARCH_SORT_OPTIONS[filters.sortBy]}` });
    }

    if (filters.excludeWatched) {
      items.push({ key: 'excludeWatched', label: 'Excluindo assistidos' });
    }

    if (filters.onlyToWatch) {
      items.push({ key: 'onlyToWatch', label: 'Somente ver depois' });
    }

    return items;
  }, [
    filters.excludeWatched,
    filters.minRating,
    filters.onlyToWatch,
    filters.sortBy,
    filters.year,
  ]);

  const hasActiveFilters = activeFilters.length > 0;
  const hasConflictingPersonalFilters = filters.excludeWatched && filters.onlyToWatch;

  const transformSearchPageMovies = useCallback(
    (pageMovies) => {
      const movies = [...pageMovies];

      if (filters.sortBy === 'ratingDesc') {
        return movies.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      }

      if (filters.sortBy === 'ratingAsc') {
        return movies.sort((a, b) => (a.vote_average || 0) - (b.vote_average || 0));
      }

      if (filters.sortBy === 'popularityDesc') {
        return movies.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      }

      if (filters.sortBy === 'popularityAsc') {
        return movies.sort((a, b) => (a.popularity || 0) - (b.popularity || 0));
      }

      if (filters.sortBy === 'newest') {
        return movies.sort((a, b) => {
          const dateA = parseDate(a.release_date);
          const dateB = parseDate(b.release_date);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateB.getTime() - dateA.getTime();
        });
      }

      if (filters.sortBy === 'oldest') {
        return movies.sort((a, b) => {
          const dateA = parseDate(a.release_date);
          const dateB = parseDate(b.release_date);
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return dateA.getTime() - dateB.getTime();
        });
      }

      return movies;
    },
    [filters.sortBy]
  );

  const searchFetchFunction = useCallback(
    (page) =>
      fetchMoviesBySearch(activeQuery, page, {
        year: filters.year,
      }),
    [activeQuery, filters.year]
  );

  const transformSearchMovies = useCallback(
    (movies) => {
      let transformedMovies = [...movies];

      if (filters.minRating) {
        const minRatingValue = Number(filters.minRating);
        if (Number.isFinite(minRatingValue)) {
          transformedMovies = transformedMovies.filter((movie) => (movie.vote_average || 0) >= minRatingValue);
        }
      }

      if (filters.excludeWatched) {
        transformedMovies = transformedMovies.filter((movie) => !watchedIds.has(movie.id));
      }

      if (filters.onlyToWatch) {
        transformedMovies = transformedMovies.filter((movie) => toWatchIds.has(movie.id));
      }

      return transformedMovies;
    },
    [filters.excludeWatched, filters.minRating, filters.onlyToWatch, toWatchIds, watchedIds]
  );

  const emptyStateTitle = useMemo(() => {
    if (!activeQuery) {
      return 'Busque por um título para começar';
    }

    if (hasActiveFilters) {
      return 'Nenhum filme corresponde aos filtros da busca';
    }

    return `Nenhum resultado encontrado para "${activeQuery}"`;
  }, [activeQuery, hasActiveFilters]);

  const emptyStateDescription = useMemo(() => {
    if (!activeQuery) {
      return 'Use o campo de busca desta página ou a lupa no menu para encontrar filmes por nome.';
    }

    if (hasActiveFilters) {
      return 'Ajuste ou remova filtros para ampliar os resultados e encontrar títulos relevantes.';
    }

    return 'Tente um termo diferente ou confira se o título foi digitado corretamente.';
  }, [activeQuery, hasActiveFilters]);

  const seoTitle = activeQuery ? `Resultados para "${activeQuery}"` : 'Busca de filmes';
  const seoDescription = activeQuery
    ? `Veja os resultados da busca por "${activeQuery}".`
    : 'Pesquise filmes e ajuste filtros para encontrar títulos com mais precisão.';
  const seoUrl = activeQuery
    ? `/search-results?query=${encodeURIComponent(activeQuery)}`
    : '/search-results';

  const filtersContent = (
    <>
      <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="flex flex-wrap gap-2">
          {QUICK_SORT_OPTIONS.map((option) => {
            const isActiveQuickSort = filters.sortBy === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleQuickSort(option.value)}
                className={`btn-minimal-rect rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  isActiveQuickSort ? 'btn-minimal-rect--active' : ''
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeFilters.map((filterItem) => (
            <button
              key={filterItem.key}
              type="button"
              onClick={() => handleRemoveFilter(filterItem.key)}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950/90 px-3 py-1 text-xs font-medium text-gray-200 transition-colors hover:border-tv-accent hover:text-white"
            >
              {filterItem.label}
              <FaTimes size={10} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Ano de lançamento
          <select
            name="year"
            value={filters.year}
            onChange={handleSelectChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
          >
            <option value="">Todos os anos</option>
            {YEAR_OPTIONS.map((yearOption) => (
              <option key={yearOption} value={yearOption}>
                {yearOption}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Nota mínima
          <select
            name="minRating"
            value={filters.minRating}
            onChange={handleSelectChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
          >
            {MIN_RATING_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Ordenar por
          <select
            name="sortBy"
            value={filters.sortBy}
            onChange={handleSelectChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
          >
            {Object.entries(SEARCH_SORT_OPTIONS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col justify-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              name="excludeWatched"
              checked={filters.excludeWatched}
              onChange={handleToggleChange}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-tv-accent focus:ring-tv-accent"
            />
            Excluir assistidos
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              name="onlyToWatch"
              checked={filters.onlyToWatch}
              onChange={handleToggleChange}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-tv-accent focus:ring-tv-accent"
            />
            Apenas da minha lista ver depois
          </label>
        </div>
      </div>

      {hasConflictingPersonalFilters ? (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Você ativou "Excluir assistidos" e "Apenas ver depois" ao mesmo tempo. Isso pode reduzir bastante os resultados.
        </p>
      ) : null}
    </>
  );

  const headerContent = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-end">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              hasActiveFilters
                ? 'border-neutral-700 text-gray-200 hover:border-neutral-500 hover:text-white'
                : 'cursor-not-allowed border-neutral-800 text-gray-500 opacity-60'
            }`}
          >
            Limpar filtros
          </button>
        </div>

        <form onSubmit={handleApplySearchQuery} className="space-y-3">
          <label htmlFor="search-results-query" className="block text-sm font-medium text-gray-200">
            Buscar título
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <FaSearch
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                size={14}
                aria-hidden="true"
              />
              <input
                id="search-results-query"
                type="text"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
                placeholder="Ex.: Matrix"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2 pl-9 pr-10 text-sm text-white placeholder:text-gray-500 focus:border-tv-accent focus:outline-none"
              />
              {queryDraft ? (
                <button
                  type="button"
                  onClick={handleClearQuery}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-white"
                  aria-label="Limpar termo da busca"
                >
                  <FaTimes size={12} />
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              className="btn-minimal-rect rounded-lg px-4 py-2 text-sm font-semibold sm:min-w-[112px]"
            >
              Buscar
            </button>
          </div>
        </form>

        <div className="mt-4 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileFiltersOpen(true)}
            className={`btn-minimal-rect w-full rounded-lg px-4 py-2 text-sm font-semibold ${
              hasActiveFilters ? 'btn-minimal-rect--active' : ''
            }`}
          >
            {hasActiveFilters ? `Filtros (${activeFilters.length})` : 'Filtros'}
          </button>
        </div>

        <div className="mt-4 hidden md:block">{filtersContent}</div>
      </div>

      {isMobileFiltersOpen ? (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Filtros de busca">
          <button
            type="button"
            aria-label="Fechar filtros"
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsMobileFiltersOpen(false)}
          />

          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-neutral-700 bg-neutral-950 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-white">Filtros</h2>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="rounded-lg border border-neutral-700 p-2 text-gray-300 transition-colors hover:border-neutral-500 hover:text-white"
                aria-label="Fechar filtros"
              >
                <FaTimes size={14} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-end">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasActiveFilters}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  hasActiveFilters
                    ? 'border-neutral-700 text-gray-200 hover:border-neutral-500 hover:text-white'
                    : 'cursor-not-allowed border-neutral-800 text-gray-500 opacity-60'
                }`}
              >
                Limpar filtros
              </button>
            </div>

            {filtersContent}

            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(false)}
              className="btn-minimal-rect btn-minimal-rect--active mt-5 w-full rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Ver resultados
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <PageSEO
        title={seoTitle}
        description={seoDescription}
        url={seoUrl}
      />
      <MovieList
        title={activeQuery ? `Resultados para "${activeQuery}"` : 'Busca de filmes'}
        fetchFunction={searchFetchFunction}
        queryKey={[
          'search',
          activeQuery,
          filters.year,
          filters.minRating,
          filters.sortBy,
          filters.excludeWatched,
          filters.onlyToWatch,
        ]}
        headerContent={headerContent}
        transformPageMovies={transformSearchPageMovies}
        transformMovies={transformSearchMovies}
        emptyStateTitle={emptyStateTitle}
        emptyStateDescription={emptyStateDescription}
        showResultCount={Boolean(activeQuery)}
        disableInfiniteScroll={filters.onlyToWatch}
      />
    </>
  );
};

export default SearchResults;