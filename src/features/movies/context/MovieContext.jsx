import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchMoviesFromLocalStorage } from '../api';
import { normalizeMovie, normalizeMovieList } from '../utils/movieAdapter';

export const MovieContext = createContext();

export const MovieProvider = ({ children }) => {
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [toWatchMovies, setToWatchMovies] = useState([]);

  useEffect(() => {
    const { watchedMovies: storedWatched, toWatchMovies: storedToWatch } = fetchMoviesFromLocalStorage();

    setWatchedMovies(normalizeMovieList(storedWatched));
    setToWatchMovies(normalizeMovieList(storedToWatch));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
      localStorage.setItem('toWatchMovies', JSON.stringify(toWatchMovies));
    } catch (error) {
      console.error('Erro ao salvar filmes no localStorage:', error);
    }
  }, [watchedMovies, toWatchMovies]);

  const isValidMovie = (movie) => movie && movie.id != null;

  const addToWatched = useCallback((movie) => {
    if (!isValidMovie(movie)) {
      console.warn('Tentativa de adicionar filme inválido aos assistidos:', movie);
      return;
    }

    const normalizedMovie = normalizeMovie(movie);

    setWatchedMovies((prev) => {
      if (prev.some((item) => item.id === normalizedMovie.id)) {
        return prev;
      }
      return [...prev, normalizedMovie];
    });

    setToWatchMovies((prev) => prev.filter((item) => item.id !== normalizedMovie.id));
  }, []);

  const addToToWatch = useCallback((movie) => {
    if (!isValidMovie(movie)) {
      console.warn('Tentativa de adicionar filme inválido à lista para assistir:', movie);
      return;
    }

    const normalizedMovie = normalizeMovie(movie);

    setToWatchMovies((prev) => {
      if (prev.some((item) => item.id === normalizedMovie.id)) {
        return prev;
      }
      return [...prev, normalizedMovie];
    });

    setWatchedMovies((prev) => prev.filter((item) => item.id !== normalizedMovie.id));
  }, []);

  const removeFromWatched = useCallback((movieId) => {
    setWatchedMovies((prev) => prev.filter((item) => item.id !== movieId));
  }, []);

  const removeFromToWatch = useCallback((movieId) => {
    setToWatchMovies((prev) => prev.filter((item) => item.id !== movieId));
  }, []);

  const providerValue = useMemo(
    () => ({
      watchedMovies,
      toWatchMovies,
      addToWatched,
      addToToWatch,
      removeFromWatched,
      removeFromToWatch,
    }),
    [watchedMovies, toWatchMovies, addToWatched, addToToWatch, removeFromWatched, removeFromToWatch]
  );

  return <MovieContext.Provider value={providerValue}>{children}</MovieContext.Provider>;
};
