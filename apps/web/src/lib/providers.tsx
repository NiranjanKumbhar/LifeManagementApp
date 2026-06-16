'use client';

import { useState, type ReactNode } from 'react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { ToastProvider } from '@lifesync/ui';
import { trpc } from './trpc';
import { ThemeProvider } from './theme';
import { NavPrefsProvider } from './nav-prefs';
import { WorkspaceProvider } from './workspace-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/trpc';

/** Wires the tRPC client to React Query, attaching the Clerk session token. */
function TRPCProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Local-first feel: serve cached data, refresh quietly.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: API_URL,
          async headers() {
            const token = await getToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <NavPrefsProvider>
          <TRPCProvider>
            <WorkspaceProvider>
              <ToastProvider>{children}</ToastProvider>
            </WorkspaceProvider>
          </TRPCProvider>
        </NavPrefsProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
