import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MovieProvider } from '../features/movies/context/MovieContext';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

export const renderWithProviders = (
  ui,
  { route = '/', initialEntries, queryClient = createTestQueryClient(), ...renderOptions } = {}
) => {
  const Wrapper = ({ children }) => {
    const helmetContext = {};

    return (
      <MemoryRouter initialEntries={initialEntries ?? [route]}>
        <QueryClientProvider client={queryClient}>
          <HelmetProvider context={helmetContext}>
            <MovieProvider>{children}</MovieProvider>
          </HelmetProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
};

export default renderWithProviders;


