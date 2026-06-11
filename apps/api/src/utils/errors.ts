/**
 * Result pattern + typed application errors.
 *
 * Services return `Result<T, AppError>` and never throw untyped errors.
 * Routers translate an `err` Result into a `TRPCError` via `unwrap` (see trpc.ts).
 */

export type AppErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL';

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

export function appError(
  code: AppErrorCode,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return { code, message, ...(details ? { details } : {}) };
}

// Convenience constructors for the common cases.
export const notFound = (message = 'Not found', details?: Record<string, unknown>): AppError =>
  appError('NOT_FOUND', message, details);

export const forbidden = (message = 'Forbidden', details?: Record<string, unknown>): AppError =>
  appError('FORBIDDEN', message, details);

export const validation = (message = 'Validation failed', details?: Record<string, unknown>): AppError =>
  appError('VALIDATION', message, details);

export const conflict = (message = 'Conflict', details?: Record<string, unknown>): AppError =>
  appError('CONFLICT', message, details);

export const internal = (message = 'Internal error', details?: Record<string, unknown>): AppError =>
  appError('INTERNAL', message, details);
