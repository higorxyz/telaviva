import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { MovieProvider } from '../../features/movies/context/MovieContext';
import { queryClient } from './queryClient';

const AppProviders = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <MovieProvider>
      <HelmetProvider>
        {children}
      </HelmetProvider>
    </MovieProvider>
  </QueryClientProvider>
);

export default AppProviders;


