import React, { createContext, useState, useEffect } from 'react';
// ctxt
export const MovieContext = createContext();

export const MovieProvider = ({ children }) => {
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [toWatchMovies, setToWatchMovies] = useState([]);

  useEffect(() => {
    const storedWatched = JSON.parse(localStorage.getItem('watchedMovies')) || [];
    const storedToWatch = JSON.parse(localStorage.getItem('toWatchMovies')) || [];
    setWatchedMovies(storedWatched);
    setToWatchMovies(storedToWatch);
  }, []);

  useEffect(() => {
    localStorage.setItem('watchedMovies', JSON.stringify(watchedMovies));
    localStorage.setItem('toWatchMovies', JSON.stringify(toWatchMovies));
  }, [watchedMovies, toWatchMovies]);

  const addToWatched = (movie) => {
    setWatchedMovies((prev) => [...prev, movie]);
    setToWatchMovies((prev) => prev.filter((m) => m.id !== movie.id));
  };

  const addToToWatch = (movie) => {
    setToWatchMovies((prev) => [...prev, movie]);
  };

  const removeFromWatched = (movieId) => {
    setWatchedMovies((prev) => prev.filter((m) => m.id !== movieId));
  };

  const removeFromToWatch = (movieId) => {
    setToWatchMovies((prev) => prev.filter((m) => m.id !== movieId));
  };

  return (
    <MovieContext.Provider value={{ 
      watchedMovies, 
      toWatchMovies, 
      addToWatched, 
      addToToWatch, 
      removeFromWatched, 
      removeFromToWatch 
    }}>
      {children}
    </MovieContext.Provider>
  );
};
