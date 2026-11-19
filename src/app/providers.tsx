'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { NavigationTracker } from '@/features/detail/NavigationTracker';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import { ToastProvider } from '@/ui/toast/ToastProvider';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider>
          <NavigationTracker />
          {children}
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
