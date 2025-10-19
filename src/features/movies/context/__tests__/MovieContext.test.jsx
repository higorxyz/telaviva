import React, { useContext } from 'react';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { MovieProvider, MovieContext } from '../MovieContext';

const wrapper = ({ children }) => <MovieProvider>{children}</MovieProvider>;

describe('MovieContext', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    localStorage.clear();
    const originalError = console.error;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.includes('ReactDOMTestUtils.act')) {
        return;
      }
      originalError(message, ...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('adiciona filmes aos assistidos sem duplicar e remove da lista para ver', () => {
    const movie = { id: 42, title: 'Filme Teste' };
    const { result } = renderHook(() => useContext(MovieContext), { wrapper });

    act(() => {
      result.current.addToToWatch(movie);
      result.current.addToWatched(movie);
      result.current.addToWatched(movie);
    });

    expect(result.current.watchedMovies).toHaveLength(1);
    expect(result.current.toWatchMovies).toHaveLength(0);
  });

  it('adiciona filmes na lista para assistir e remove da lista de assistidos', () => {
    const movie = { id: 7, title: 'Outro Filme' };
    const { result } = renderHook(() => useContext(MovieContext), { wrapper });

    act(() => {
      result.current.addToWatched(movie);
      result.current.addToToWatch(movie);
      result.current.addToToWatch(movie);
    });

    expect(result.current.toWatchMovies).toHaveLength(1);
    expect(result.current.watchedMovies).toHaveLength(0);
  });
});


