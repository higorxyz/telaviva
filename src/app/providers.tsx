'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { NavigationTracker } from '@/features/detail/NavigationTracker';
import { AuthLibrary } from '@/features/auth/AuthLibrary';
import { AuthProvider } from '@/features/auth/AuthProvider';
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
        {/* Outside the library: an identity change remounts the library's tree, not the sign-in state. */}
        <AuthProvider>
          <AuthLibrary>
            <NavigationTracker />
            {children}
          </AuthLibrary>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
