import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { FaChevronLeft, FaFilter, FaTimes } from 'react-icons/fa';
import {
  DISCOVER_SORT_BY_OPTIONS,
  fetchCategories,
  fetchDiscoverMovies,
  fetchMovieProviders,
} from '../api';
import MovieCard from '../components/MovieCard';
import MovieCardSkeleton from '../components/MovieCardSkeleton';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import Loading from '../../../components/feedback/Loading';
import PageSEO from '../../../components/seo/PageSEO';
import useIntersectionObserver from '../../../hooks/useIntersectionObserver';
import { MovieContext } from '../context/MovieContext';

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_WATCH_REGION = 'BR';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'discover.sidebar.collapsed';
const RUNTIME_MIN_LIMIT = 40;
const RUNTIME_MAX_LIMIT = 400;
const RUNTIME_STEP = 5;
const RATING_STEP = 0.5;
const MOVIE_BATCH_SIZE = 24;

const DEFAULT_DISCOVER_FILTERS = {
  genreId: '',
  yearFrom: '',
  yearTo: '',
  minVoteAverage: '',
  minVoteCount: '',
  runtimeGte: '',
  runtimeLte: '',
  originalLanguage: '',
  watchRegion: DEFAULT_WATCH_REGION,
  watchProviderIds: [],
  sortBy: 'popularity.desc',
  includeAdult: false,
};

const DEFAULT_LOCAL_VIEW_FILTERS = {
  excludeWatched: false,
  excludeToWatch: false,
  localSortBy: 'server',
};

const DISCOVER_SORT_OPTIONS_LABELS = {
  'popularity.desc': 'Popularidade (maior para menor)',
  'popularity.asc': 'Popularidade (menor para maior)',
  'release_date.desc': 'Lançamento (mais recentes)',
  'release_date.asc': 'Lançamento (mais antigos)',
  'vote_average.desc': 'Nota média (maior para menor)',
  'vote_average.asc': 'Nota média (menor para maior)',
  'vote_count.desc': 'Quantidade de votos (maior para menor)',
};

const LOCAL_SORT_OPTIONS = {
  server: 'Ordenação da API',
  ratingDesc: 'Nota local (maior para menor)',
  newest: 'Lançamento (mais recentes)',
  oldest: 'Lançamento (mais antigos)',
};

const REGION_OPTIONS = [
  { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'AR', label: 'Argentina' },
  { value: 'ES', label: 'Espanha' },
  { value: 'FR', label: 'França' },
  { value: 'IT', label: 'Italia' },
  { value: 'JP', label: 'Japão' },
  { value: 'KR', label: 'Coreia do Sul' },
];

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Todos os idiomas' },
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'Inglês' },
  { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Francês' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: 'Japonês' },
  { value: 'ko', label: 'Coreano' },
];

const PRIORITY_PROVIDER_KEYWORDS = [
  'netflix',
  'prime video',
  'amazon prime',
  'disney+',
  'disney plus',
  'globoplay',
];

const ALLOWED_SORT_OPTIONS = new Set(DISCOVER_SORT_BY_OPTIONS);

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clampNumber = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
};

const parseSearchParamsToFilters = (searchParams) => {
  const sortByFromUrl = searchParams.get('sortBy') || DEFAULT_DISCOVER_FILTERS.sortBy;
  const providersFromUrl = searchParams
    .get('providers')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

  const fallbackYear = searchParams.get('year') || '';
  const yearFrom = searchParams.get('yearFrom') || fallbackYear;
  const yearTo = searchParams.get('yearTo') || fallbackYear;

  const watchRegionFromUrl = (searchParams.get('region') || DEFAULT_WATCH_REGION).toUpperCase();
  const normalizedWatchRegion = watchRegionFromUrl.length === 2
    ? watchRegionFromUrl
    : DEFAULT_WATCH_REGION;

  return {
    genreId: searchParams.get('genre') || '',
    yearFrom,
    yearTo,
    minVoteAverage: searchParams.get('minRating') || '',
    minVoteCount: searchParams.get('minVotes') || '',
    runtimeGte: searchParams.get('minRuntime') || '',
    runtimeLte: searchParams.get('maxRuntime') || '',
    originalLanguage: searchParams.get('lang') || '',
    watchRegion: normalizedWatchRegion,
    watchProviderIds: providersFromUrl,
    sortBy: ALLOWED_SORT_OPTIONS.has(sortByFromUrl)
      ? sortByFromUrl
      : DEFAULT_DISCOVER_FILTERS.sortBy,
    includeAdult: searchParams.get('adult') === '1',
  };
};

const filtersToSearchParams = (filters) => {
  const params = new URLSearchParams();

  if (filters.genreId) params.set('genre', filters.genreId);
  if (filters.yearFrom) params.set('yearFrom', filters.yearFrom);
  if (filters.yearTo) params.set('yearTo', filters.yearTo);
  if (filters.minVoteAverage) params.set('minRating', filters.minVoteAverage);
  if (filters.minVoteCount) params.set('minVotes', filters.minVoteCount);
  if (filters.runtimeGte) params.set('minRuntime', filters.runtimeGte);
  if (filters.runtimeLte) params.set('maxRuntime', filters.runtimeLte);
  if (filters.originalLanguage) params.set('lang', filters.originalLanguage);
  if (filters.watchRegion && filters.watchRegion !== DEFAULT_WATCH_REGION) {
    params.set('region', filters.watchRegion);
  }
  if (Array.isArray(filters.watchProviderIds) && filters.watchProviderIds.length > 0) {
    params.set('providers', filters.watchProviderIds.join(','));
  }
  if (filters.sortBy && filters.sortBy !== DEFAULT_DISCOVER_FILTERS.sortBy) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.includeAdult) params.set('adult', '1');

  return params;
};

const getProviderPriority = (providerName) => {
  if (typeof providerName !== 'string') {
    return PRIORITY_PROVIDER_KEYWORDS.length + 1;
  }

  const normalized = providerName.toLowerCase();
  const index = PRIORITY_PROVIDER_KEYWORDS.findIndex((keyword) => normalized.includes(keyword));

  return index === -1 ? PRIORITY_PROVIDER_KEYWORDS.length + 1 : index;
};

const DiscoverMovies = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { watchedMovies, toWatchMovies } = useContext(MovieContext);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const appliedFilters = useMemo(
    () => parseSearchParamsToFilters(searchParams),
    [searchParams]
  );

  const [draftFilters, setDraftFilters] = useState(appliedFilters);
  const [localViewFilters, setLocalViewFilters] = useState(DEFAULT_LOCAL_VIEW_FILTERS);
  const [visibleCount, setVisibleCount] = useState(MOVIE_BATCH_SIZE);

  useEffect(() => {
    setDraftFilters(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, isSidebarCollapsed ? '1' : '0');
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!isMobileSidebarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const yearOptions = useMemo(
    () => Array.from({ length: CURRENT_YEAR - 1898 }, (_, index) => String(CURRENT_YEAR + 1 - index)),
    []
  );

  const runtimeBounds = useMemo(() => {
    const rawMin = toNumberOrUndefined(draftFilters.runtimeGte);
    const rawMax = toNumberOrUndefined(draftFilters.runtimeLte);

    let min = Number.isFinite(rawMin)
      ? clampNumber(rawMin, RUNTIME_MIN_LIMIT, RUNTIME_MAX_LIMIT)
      : RUNTIME_MIN_LIMIT;

    let max = Number.isFinite(rawMax)
      ? clampNumber(rawMax, RUNTIME_MIN_LIMIT, RUNTIME_MAX_LIMIT)
      : RUNTIME_MAX_LIMIT;

    if (min > max) {
      [min, max] = [max, min];
    }

    return { min, max };
  }, [draftFilters.runtimeGte, draftFilters.runtimeLte]);

  const runtimeSummaryLabel = useMemo(() => {
    const hasMinimumFilter = runtimeBounds.min > RUNTIME_MIN_LIMIT;
    const hasMaximumFilter = runtimeBounds.max < RUNTIME_MAX_LIMIT;

    if (!hasMinimumFilter && !hasMaximumFilter) {
      return 'Sem limite';
    }

    if (hasMinimumFilter && !hasMaximumFilter) {
      return `>= ${runtimeBounds.min} min`;
    }

    if (!hasMinimumFilter && hasMaximumFilter) {
      return `<= ${runtimeBounds.max} min`;
    }

    return `${runtimeBounds.min} - ${runtimeBounds.max}`;
  }, [runtimeBounds.max, runtimeBounds.min]);

  const ratingSliderValue = useMemo(() => {
    const parsed = toNumberOrUndefined(draftFilters.minVoteAverage);
    return Number.isFinite(parsed) ? clampNumber(parsed, 0, 10) : 0;
  }, [draftFilters.minVoteAverage]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;

    if (draftFilters.genreId) count += 1;
    if (draftFilters.yearFrom || draftFilters.yearTo) count += 1;
    if (ratingSliderValue > 0) count += 1;

    const votes = toNumberOrUndefined(draftFilters.minVoteCount);
    if (Number.isFinite(votes) && votes > 0) count += 1;

    if (runtimeBounds.min > RUNTIME_MIN_LIMIT || runtimeBounds.max < RUNTIME_MAX_LIMIT) {
      count += 1;
    }

    if (draftFilters.originalLanguage) count += 1;
    if (draftFilters.watchProviderIds.length > 0) count += 1;
    if (draftFilters.watchRegion !== DEFAULT_WATCH_REGION && draftFilters.watchProviderIds.length > 0) {
      count += 1;
    }
    if (draftFilters.sortBy !== DEFAULT_DISCOVER_FILTERS.sortBy) count += 1;
    if (draftFilters.includeAdult) count += 1;

    if (localViewFilters.excludeWatched) count += 1;
    if (localViewFilters.excludeToWatch) count += 1;
    if (localViewFilters.localSortBy !== DEFAULT_LOCAL_VIEW_FILTERS.localSortBy) count += 1;

    return count;
  }, [
    draftFilters.genreId,
    draftFilters.includeAdult,
    draftFilters.minVoteCount,
    draftFilters.originalLanguage,
    draftFilters.sortBy,
    draftFilters.watchProviderIds,
    draftFilters.watchRegion,
    draftFilters.yearFrom,
    draftFilters.yearTo,
    localViewFilters.excludeToWatch,
    localViewFilters.excludeWatched,
    localViewFilters.localSortBy,
    ratingSliderValue,
    runtimeBounds.max,
    runtimeBounds.min,
  ]);

  const { data: genres = [], isLoading: isGenresLoading } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const {
    data: providers = [],
    isLoading: isProvidersLoading,
  } = useQuery({
    queryKey: ['watch-providers', 'movie', draftFilters.watchRegion],
    queryFn: () => fetchMovieProviders(draftFilters.watchRegion),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
  });

  const sortedProviders = useMemo(() => {
    const list = Array.isArray(providers) ? [...providers] : [];

    return list.sort((firstProvider, secondProvider) => {
      const firstPriority = getProviderPriority(firstProvider.provider_name);
      const secondPriority = getProviderPriority(secondProvider.provider_name);

      if (firstPriority !== secondPriority) {
        return firstPriority - secondPriority;
      }

      const firstDisplayPriority = Number.isFinite(firstProvider.display_priority)
        ? firstProvider.display_priority
        : 999;
      const secondDisplayPriority = Number.isFinite(secondProvider.display_priority)
        ? secondProvider.display_priority
        : 999;

      if (firstDisplayPriority !== secondDisplayPriority) {
        return firstDisplayPriority - secondDisplayPriority;
      }

      return (firstProvider.provider_name || '').localeCompare(secondProvider.provider_name || '', 'pt-BR');
    });
  }, [providers]);

  const watchedIds = useMemo(
    () => new Set(watchedMovies.map((movie) => movie.id)),
    [watchedMovies]
  );

  const toWatchIds = useMemo(
    () => new Set(toWatchMovies.map((movie) => movie.id)),
    [toWatchMovies]
  );

  const selectedGenreName = useMemo(() => {
    const match = genres.find((genre) => String(genre.id) === String(appliedFilters.genreId));
    return match?.name || null;
  }, [appliedFilters.genreId, genres]);

  const seoTitle = selectedGenreName
    ? `Descobrir filmes de ${selectedGenreName}`
    : 'Descobrir filmes';

  const seoDescription = selectedGenreName
    ? `Explore filmes de ${selectedGenreName} com filtros de nota, ano, votos e duração.`
    : 'Descubra filmes com filtros avançados de gênero, nota, duração e ano.';

  const discoverApiFilters = useMemo(() => {
    const yearFrom = toNumberOrUndefined(appliedFilters.yearFrom);
    const yearTo = toNumberOrUndefined(appliedFilters.yearTo);

    const exactYear = Number.isFinite(yearFrom) && Number.isFinite(yearTo) && yearFrom === yearTo
      ? String(yearFrom)
      : undefined;

    return {
      ...appliedFilters,
      year: exactYear,
    };
  }, [appliedFilters]);

  const discoverFetchFunction = useCallback(
    (page) => fetchDiscoverMovies(discoverApiFilters, page),
    [discoverApiFilters]
  );

  const discoverQueryKey = useMemo(() => ['discover', appliedFilters], [appliedFilters]);

  useEffect(() => {
    setVisibleCount(MOVIE_BATCH_SIZE);
  }, [discoverQueryKey]);

  const { targetRef: sentinelRef, isVisible } = useIntersectionObserver({
    rootMargin: '200px 0px',
  });

  const {
    data,
    status,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['movies-list', ...discoverQueryKey],
    queryFn: ({ pageParam = 1 }) => discoverFetchFunction(pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const movies = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);

  const visibleMovies = useMemo(() => {
    let transformedMovies = [...movies];

    const yearFrom = toNumberOrUndefined(appliedFilters.yearFrom);
    const yearTo = toNumberOrUndefined(appliedFilters.yearTo);

    if (Number.isFinite(yearFrom) || Number.isFinite(yearTo)) {
      transformedMovies = transformedMovies.filter((movie) => {
        const parsedReleaseDate = parseDate(movie.release_date);
        if (!parsedReleaseDate) {
          return false;
        }

        const releaseYear = parsedReleaseDate.getFullYear();

        if (Number.isFinite(yearFrom) && releaseYear < yearFrom) {
          return false;
        }

        if (Number.isFinite(yearTo) && releaseYear > yearTo) {
          return false;
        }

        return true;
      });
    }

    if (localViewFilters.excludeWatched) {
      transformedMovies = transformedMovies.filter((movie) => !watchedIds.has(movie.id));
    }

    if (localViewFilters.excludeToWatch) {
      transformedMovies = transformedMovies.filter((movie) => !toWatchIds.has(movie.id));
    }

    if (localViewFilters.localSortBy === 'ratingDesc') {
      transformedMovies.sort((firstMovie, secondMovie) =>
        (secondMovie.vote_average || 0) - (firstMovie.vote_average || 0)
      );
    }

    if (localViewFilters.localSortBy === 'newest') {
      transformedMovies.sort((firstMovie, secondMovie) => {
        const firstDate = parseDate(firstMovie.release_date);
        const secondDate = parseDate(secondMovie.release_date);
        if (!firstDate && !secondDate) return 0;
        if (!firstDate) return 1;
        if (!secondDate) return -1;
        return secondDate.getTime() - firstDate.getTime();
      });
    }

    if (localViewFilters.localSortBy === 'oldest') {
      transformedMovies.sort((firstMovie, secondMovie) => {
        const firstDate = parseDate(firstMovie.release_date);
        const secondDate = parseDate(secondMovie.release_date);
        if (!firstDate && !secondDate) return 0;
        if (!firstDate) return 1;
        if (!secondDate) return -1;
        return firstDate.getTime() - secondDate.getTime();
      });
    }

    return transformedMovies;
  }, [
    appliedFilters.yearFrom,
    appliedFilters.yearTo,
    localViewFilters.excludeToWatch,
    localViewFilters.excludeWatched,
    localViewFilters.localSortBy,
    movies,
    toWatchIds,
    watchedIds,
  ]);

  const displayedMovies = useMemo(
    () => visibleMovies.slice(0, visibleCount),
    [visibleCount, visibleMovies]
  );

  const hasHiddenLoadedMovies = displayedMovies.length < visibleMovies.length;
  const shouldRenderSentinel = movies.length > 0 && (hasHiddenLoadedMovies || Boolean(hasNextPage));

  useEffect(() => {
    if (status !== 'success') {
      return;
    }

    if (visibleMovies.length >= MOVIE_BATCH_SIZE) {
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, status, visibleMovies.length]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    if (displayedMovies.length < MOVIE_BATCH_SIZE && hasNextPage) {
      return;
    }

    const remainingLoaded = visibleMovies.length - displayedMovies.length;

    if (remainingLoaded >= MOVIE_BATCH_SIZE || (!hasNextPage && remainingLoaded > 0)) {
      setVisibleCount((previousCount) => Math.min(previousCount + MOVIE_BATCH_SIZE, visibleMovies.length));
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    displayedMovies.length,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isVisible,
    visibleMovies.length,
  ]);

  const totalResults = useMemo(() => data?.pages[0]?.totalResults ?? 0, [data]);

  const normalizeDraftFilters = useCallback((rawFilters) => {
    const normalized = {
      ...rawFilters,
      watchProviderIds: Array.isArray(rawFilters.watchProviderIds)
        ? [...new Set(rawFilters.watchProviderIds.map((providerId) => String(providerId).trim()).filter(Boolean))]
        : [],
      minVoteCount: String(rawFilters.minVoteCount || '').replace(/\D+/g, ''),
      sortBy: ALLOWED_SORT_OPTIONS.has(rawFilters.sortBy)
        ? rawFilters.sortBy
        : DEFAULT_DISCOVER_FILTERS.sortBy,
    };

    const rating = toNumberOrUndefined(rawFilters.minVoteAverage);
    normalized.minVoteAverage = Number.isFinite(rating) && rating > 0
      ? String(rating)
      : '';

    let yearFrom = toNumberOrUndefined(rawFilters.yearFrom);
    let yearTo = toNumberOrUndefined(rawFilters.yearTo);

    if (Number.isFinite(yearFrom)) {
      yearFrom = clampNumber(yearFrom, 1900, CURRENT_YEAR + 1);
    }

    if (Number.isFinite(yearTo)) {
      yearTo = clampNumber(yearTo, 1900, CURRENT_YEAR + 1);
    }

    if (Number.isFinite(yearFrom) && Number.isFinite(yearTo) && yearFrom > yearTo) {
      [yearFrom, yearTo] = [yearTo, yearFrom];
    }

    normalized.yearFrom = Number.isFinite(yearFrom) ? String(yearFrom) : '';
    normalized.yearTo = Number.isFinite(yearTo) ? String(yearTo) : '';

    const runtimeMinRaw = toNumberOrUndefined(rawFilters.runtimeGte);
    const runtimeMaxRaw = toNumberOrUndefined(rawFilters.runtimeLte);

    let runtimeMin = Number.isFinite(runtimeMinRaw)
      ? clampNumber(runtimeMinRaw, RUNTIME_MIN_LIMIT, RUNTIME_MAX_LIMIT)
      : RUNTIME_MIN_LIMIT;

    let runtimeMax = Number.isFinite(runtimeMaxRaw)
      ? clampNumber(runtimeMaxRaw, RUNTIME_MIN_LIMIT, RUNTIME_MAX_LIMIT)
      : RUNTIME_MAX_LIMIT;

    if (runtimeMin > runtimeMax) {
      [runtimeMin, runtimeMax] = [runtimeMax, runtimeMin];
    }

    normalized.runtimeGte = runtimeMin > RUNTIME_MIN_LIMIT ? String(runtimeMin) : '';
    normalized.runtimeLte = runtimeMax < RUNTIME_MAX_LIMIT ? String(runtimeMax) : '';

    return normalized;
  }, []);

  const handleInputChange = useCallback((event) => {
    const { name, type, value, checked } = event.target;

    if (name === 'watchRegion') {
      setDraftFilters((previous) => ({
        ...previous,
        watchRegion: value,
        watchProviderIds: [],
      }));
      return;
    }

    if (name === 'minVoteCount') {
      const numericOnlyValue = value.replace(/\D+/g, '');
      setDraftFilters((previous) => ({
        ...previous,
        minVoteCount: numericOnlyValue,
      }));
      return;
    }

    if (name === 'yearFrom') {
      setDraftFilters((previous) => {
        const nextYearFrom = value;
        const previousYearTo = previous.yearTo;

        if (nextYearFrom && previousYearTo && Number(nextYearFrom) > Number(previousYearTo)) {
          return {
            ...previous,
            yearFrom: nextYearFrom,
            yearTo: nextYearFrom,
          };
        }

        return {
          ...previous,
          yearFrom: nextYearFrom,
        };
      });
      return;
    }

    if (name === 'yearTo') {
      setDraftFilters((previous) => {
        const nextYearTo = value;
        const previousYearFrom = previous.yearFrom;

        if (nextYearTo && previousYearFrom && Number(nextYearTo) < Number(previousYearFrom)) {
          return {
            ...previous,
            yearFrom: nextYearTo,
            yearTo: nextYearTo,
          };
        }

        return {
          ...previous,
          yearTo: nextYearTo,
        };
      });
      return;
    }

    setDraftFilters((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleRatingSliderChange = useCallback((event) => {
    setDraftFilters((previous) => ({
      ...previous,
      minVoteAverage: event.target.value,
    }));
  }, []);

  const handleRuntimeMinChange = useCallback((event) => {
    const nextMin = clampNumber(Number(event.target.value), RUNTIME_MIN_LIMIT, RUNTIME_MAX_LIMIT);

    setDraftFilters((previous) => ({
      ...previous,
      runtimeGte: String(nextMin),
      runtimeLte: String(Math.max(nextMin, runtimeBounds.max)),
    }));
  }, [runtimeBounds.max]);

  const handleRuntimeMaxChange = useCallback((event) => {
    const nextMax = clampNumber(Number(event.target.value), RUNTIME_MIN_LIMIT, RUNTIME_MAX_LIMIT);

    setDraftFilters((previous) => ({
      ...previous,
      runtimeGte: String(Math.min(nextMax, runtimeBounds.min)),
      runtimeLte: String(nextMax),
    }));
  }, [runtimeBounds.min]);

  const handleToggleProvider = useCallback((providerId) => {
    const providerIdAsString = String(providerId);

    setDraftFilters((previous) => {
      const providerIds = Array.isArray(previous.watchProviderIds) ? previous.watchProviderIds : [];
      const alreadySelected = providerIds.includes(providerIdAsString);

      if (alreadySelected) {
        return {
          ...previous,
          watchProviderIds: providerIds.filter((id) => id !== providerIdAsString),
        };
      }

      return {
        ...previous,
        watchProviderIds: [...providerIds, providerIdAsString],
      };
    });
  }, []);

  const handleLocalViewChange = useCallback((event) => {
    const { name, type, value, checked } = event.target;

    setLocalViewFilters((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleApplyFilters = useCallback((event) => {
    event.preventDefault();

    const normalizedFilters = normalizeDraftFilters(draftFilters);
    setDraftFilters(normalizedFilters);
    setSearchParams(filtersToSearchParams(normalizedFilters));
    setIsMobileSidebarOpen(false);
  }, [draftFilters, normalizeDraftFilters, setSearchParams]);

  const handleResetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_DISCOVER_FILTERS);
    setLocalViewFilters(DEFAULT_LOCAL_VIEW_FILTERS);
    setSearchParams(new URLSearchParams());
    setIsMobileSidebarOpen(false);
  }, [setSearchParams]);

  const handleResetLocalFilters = useCallback(() => {
    setLocalViewFilters(DEFAULT_LOCAL_VIEW_FILTERS);
  }, []);

  const selectedProviderIds = useMemo(
    () => new Set(draftFilters.watchProviderIds),
    [draftFilters.watchProviderIds]
  );

  const sliderAccentStyle = useMemo(() => ({ accentColor: 'var(--tv-accent)' }), []);

  const renderFiltersSections = () => (
    <div className="space-y-5">
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Filtros ativos</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {activeFiltersCount === 0
            ? 'Nenhum filtro ativo'
            : `${activeFiltersCount} ${activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}`}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3 space-y-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Gênero
          <select
            name="genreId"
            value={draftFilters.genreId}
            onChange={handleInputChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
            disabled={isGenresLoading}
          >
            <option value="">Todos os gêneros</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Ordenação
          <select
            name="sortBy"
            value={draftFilters.sortBy}
            onChange={handleInputChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
          >
            {DISCOVER_SORT_BY_OPTIONS
              .filter((value) => DISCOVER_SORT_OPTIONS_LABELS[value])
              .map((value) => (
                <option key={value} value={value}>
                  {DISCOVER_SORT_OPTIONS_LABELS[value]}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Idioma original
          <select
            name="originalLanguage"
            value={draftFilters.originalLanguage}
            onChange={handleInputChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Região de streaming
          <select
            name="watchRegion"
            value={draftFilters.watchRegion}
            onChange={handleInputChange}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
          >
            {REGION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3 space-y-3">
        <p className="text-sm font-semibold text-white">Ano de lançamento</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-300">
            De
            <select
              name="yearFrom"
              value={draftFilters.yearFrom}
              onChange={handleInputChange}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-xs text-white focus:border-tv-accent focus:outline-none"
            >
              <option value="">Qualquer</option>
              {yearOptions.map((year) => (
                <option key={`year-from-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-gray-300">
            Até
            <select
              name="yearTo"
              value={draftFilters.yearTo}
              onChange={handleInputChange}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-2.5 py-2 text-xs text-white focus:border-tv-accent focus:outline-none"
            >
              <option value="">Qualquer</option>
              {yearOptions.map((year) => (
                <option key={`year-to-${year}`} value={year}>{year}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Nota mínima</p>
          <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-gray-200">
            {ratingSliderValue <= 0 ? 'Sem mínimo' : `${ratingSliderValue.toFixed(1)}/10`}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="10"
          step={RATING_STEP}
          value={ratingSliderValue}
          onChange={handleRatingSliderChange}
          className="w-full"
          style={sliderAccentStyle}
        />
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Duração (min)</p>
          <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-gray-200">
            {runtimeSummaryLabel}
          </span>
        </div>

        <div className="space-y-2">
          <label className="flex items-center justify-between text-xs text-gray-400">
            <span>Mínima</span>
            <span>{runtimeBounds.min} min</span>
          </label>
          <input
            type="range"
            min={RUNTIME_MIN_LIMIT}
            max={RUNTIME_MAX_LIMIT}
            step={RUNTIME_STEP}
            value={runtimeBounds.min}
            onChange={handleRuntimeMinChange}
            className="w-full"
            style={sliderAccentStyle}
          />

          <label className="flex items-center justify-between text-xs text-gray-400">
            <span>Máxima</span>
            <span>{runtimeBounds.max} min</span>
          </label>
          <input
            type="range"
            min={RUNTIME_MIN_LIMIT}
            max={RUNTIME_MAX_LIMIT}
            step={RUNTIME_STEP}
            value={runtimeBounds.max}
            onChange={handleRuntimeMaxChange}
            className="w-full"
            style={sliderAccentStyle}
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3 space-y-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-200">
          Mínimo de votos
          <input
            name="minVoteCount"
            type="number"
            inputMode="numeric"
            min="0"
            value={draftFilters.minVoteCount}
            onChange={handleInputChange}
            placeholder="Ex.: 500 para resultados mais confiáveis"
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-tv-accent focus:outline-none"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-200">
          <input
            type="checkbox"
            name="includeAdult"
            checked={draftFilters.includeAdult}
            onChange={handleInputChange}
            className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-tv-accent focus:ring-tv-accent"
          />
            Incluir conteúdo adulto
        </label>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Streaming</p>
          {isProvidersLoading ? (
            <span className="inline-flex items-center rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-gray-200">
              Carregando provedores...
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-tv-accent/70 bg-tv-accent/25 px-2.5 py-1 text-xs font-semibold text-white">
              {selectedProviderIds.size} {selectedProviderIds.size === 1 ? 'selecionado' : 'selecionados'}
            </span>
          )}
        </div>

        <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
          {sortedProviders.map((provider) => {
            const isSelected = selectedProviderIds.has(String(provider.provider_id));

            return (
              <button
                key={provider.provider_id}
                type="button"
                onClick={() => handleToggleProvider(provider.provider_id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors md:text-sm ${
                  isSelected
                    ? 'border-tv-accent bg-tv-accent/30 text-white shadow-[0_0_0_1px_rgba(229,9,20,0.45)]'
                    : 'border-neutral-700 bg-neutral-900 text-gray-200 hover:border-neutral-500'
                }`}
                aria-pressed={isSelected}
              >
                {provider.logo_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                    alt={provider.provider_name}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                ) : null}
                {provider.provider_name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950/45 p-3">
        <p className="mb-3 text-sm font-semibold text-white">Filtros pessoais</p>

        <div className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              name="excludeWatched"
              checked={localViewFilters.excludeWatched}
              onChange={handleLocalViewChange}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-tv-accent focus:ring-tv-accent"
            />
            Excluir assistidos
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              name="excludeToWatch"
              checked={localViewFilters.excludeToWatch}
              onChange={handleLocalViewChange}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-950 text-tv-accent focus:ring-tv-accent"
            />
            Excluir da lista ver depois
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-200">
            Ordenação local
            <select
              name="localSortBy"
              value={localViewFilters.localSortBy}
              onChange={handleLocalViewChange}
              className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-tv-accent focus:outline-none"
            >
              {Object.entries(LOCAL_SORT_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );

  const renderFilterActions = (context = 'desktop') => (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          className="w-full rounded-lg bg-tv-accent px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-tv-accent/25 transition-colors hover:bg-tv-accent-hover"
        >
          Aplicar filtros
        </button>

        <button
          type="button"
          onClick={handleResetFilters}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-neutral-800"
        >
          Limpar filtros
        </button>
        </div>

        <p className={`text-xs text-gray-400 ${context === 'desktop' ? 'sr-only' : ''}`}>
          Filtros ficam na URL para facilitar compartilhamento.
        </p>
      </div>
  );

  return (
    <>
      <PageSEO title={seoTitle} description={seoDescription} url={`/discover?${searchParams.toString()}`} />

      <div className="min-h-screen bg-black text-white pt-24 pb-8">
        <div className="mx-auto max-w-[2000px] px-4 md:px-6 lg:px-8 xl:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">Encontre seu filme favorito</h1>
              {totalResults > 0 ? (
                <p className="mt-1 text-sm text-gray-400 md:text-base">
                  {totalResults.toLocaleString('pt-BR')} {totalResults === 1 ? 'filme encontrado' : 'filmes encontrados'}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-400 md:text-base">
                  Explore o catálogo com filtros avançados de descoberta.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="btn-minimal-rect relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold lg:hidden"
              >
                <FaFilter size={13} />
                Filtros
                {activeFiltersCount > 0 ? (
                  <span className="absolute right-1 top-1 z-10 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-tv-accent/70 bg-tv-accent px-1 text-[10px] font-bold leading-none text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((previous) => !previous)}
                className="btn-minimal-rect relative hidden items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold lg:inline-flex"
                aria-expanded={!isSidebarCollapsed}
              >
                {isSidebarCollapsed ? <FaFilter size={13} /> : <FaChevronLeft size={13} />}
                {isSidebarCollapsed ? 'Expandir filtros' : 'Recolher filtros'}
                {isSidebarCollapsed && activeFiltersCount > 0 ? (
                  <span className="absolute right-1 top-1 z-10 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-tv-accent/70 bg-tv-accent px-1 text-[10px] font-bold leading-none text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4 lg:gap-6">
            <aside
              className={`hidden shrink-0 overflow-hidden transition-all duration-300 lg:block ${
                isSidebarCollapsed ? 'w-0 opacity-0' : 'w-[280px] opacity-100'
              }`}
              aria-hidden={isSidebarCollapsed}
            >
              <div className="sticky top-24 h-[calc(100vh-16rem)] xl:h-[calc(100vh-14rem)]">
                <form onSubmit={handleApplyFilters} className="flex h-full min-h-0 flex-col">
                  <div className="discover-filters-scroll min-h-0 flex-1 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                    {renderFiltersSections()}
                  </div>
                  <div className="mt-2 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/92 p-2.5 backdrop-blur-sm">
                    {renderFilterActions('desktop')}
                  </div>
                </form>
                </div>
            </aside>

            <main className="min-w-0 flex-1">
              {status === 'pending' ? (
                <div className="grid grid-cols-3 gap-3 md:gap-4 lg:grid-cols-6 lg:gap-5 xl:grid-cols-7 2xl:grid-cols-8">
                  {Array.from({ length: 16 }).map((_, index) => (
                    <MovieCardSkeleton key={index} />
                  ))}
                </div>
              ) : null}

              {status === 'error' ? (
                <div className="flex min-h-[55vh] items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/50">
                  <ErrorMessage message={error instanceof Error ? error.message : 'Erro ao carregar os filmes.'} />
                </div>
              ) : null}

              {status !== 'pending' && status !== 'error' ? (
                <>
                  {movies.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-6 py-12 text-center">
                      <div className="text-5xl">🎬</div>
                      <h2 className="mt-4 text-2xl font-semibold text-white">Nenhum filme encontrado</h2>
                      <p className="mt-2 text-sm text-gray-400 md:text-base">
                        Nenhum título corresponde aos filtros aplicados. Tente ampliar os filtros para encontrar mais resultados.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-6 rounded-lg bg-tv-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-tv-accent-hover"
                      >
                        Limpar filtros e tentar novamente
                      </button>
                    </div>
                  ) : null}

                  {movies.length > 0 && displayedMovies.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:gap-5 xl:grid-cols-7 2xl:grid-cols-8">
                      {displayedMovies.map((movie) => (
                        <MovieCard key={movie.id} movie={movie} />
                      ))}
                    </div>
                  ) : null}

                  {movies.length > 0 && visibleMovies.length === 0 ? (
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-6 py-12 text-center">
                      <h2 className="text-xl font-semibold text-white">Nenhum filme visível com os filtros atuais</h2>
                      <p className="mt-2 text-sm text-gray-400 md:text-base">
                        Ajuste os filtros pessoais ou amplie os filtros de descoberta para mostrar mais filmes.
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetLocalFilters}
                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-neutral-800"
                        >
                          Limpar filtros pessoais
                        </button>
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="rounded-lg bg-tv-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-tv-accent-hover"
                        >
                          Limpar todos os filtros
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {visibleMovies.length !== movies.length && movies.length > 0 ? (
                    <div className="pt-4">
                      <p className="text-xs text-gray-400 md:text-sm">
                        Mostrando {visibleMovies.length} de {movies.length} filmes carregados após aplicar filtros pessoais.
                      </p>
                    </div>
                  ) : null}

                  {shouldRenderSentinel ? <div ref={sentinelRef} className="h-20" aria-hidden="true" /> : null}

                  {isFetchingNextPage ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-3">
                        <Loading fullScreen={false} backgroundClass="bg-transparent" size={32} />
                        <p className="text-sm text-gray-400">Carregando mais filmes...</p>
                      </div>
                    </div>
                  ) : null}

                  {!hasNextPage && displayedMovies.length > 0 && displayedMovies.length >= visibleMovies.length ? (
                    <div className="flex flex-col items-center py-10">
                      <div className="mb-4 h-1 w-16 rounded-full bg-gradient-to-r from-transparent via-tv-accent to-transparent" />
                      <p className="text-center text-sm text-gray-400 md:text-base">
                        Você visualizou todos os {visibleMovies.length} filmes disponíveis
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </main>
          </div>
        </div>

        <div
          className={`fixed inset-0 z-[60] bg-black/70 transition-opacity duration-300 lg:hidden ${
            isMobileSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`fixed inset-y-0 left-0 z-[70] w-[88%] max-w-sm transform border-r border-neutral-800 bg-neutral-950 transition-transform duration-300 lg:hidden ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Filtros de descoberta"
        >
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Filtros</p>
              <p className="text-xs text-gray-400">Ajuste e aplique para atualizar os resultados</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 text-gray-200 transition-colors hover:bg-neutral-800"
              aria-label="Fechar filtros"
            >
              <FaTimes size={14} />
            </button>
          </div>

          <div className="h-[calc(100%-72px)]">
            <form onSubmit={handleApplyFilters} className="flex h-full min-h-0 flex-col">
              <div className="discover-filters-scroll min-h-0 flex-1 overflow-y-auto p-4">
                {renderFiltersSections()}
              </div>
              <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-3">
                {renderFilterActions('mobile')}
              </div>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
};

export default DiscoverMovies;
