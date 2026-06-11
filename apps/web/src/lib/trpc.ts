import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query';
import type { AppRouter } from 'api';

/** Typed tRPC + React Query hooks for the LifeSync API. */
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();
