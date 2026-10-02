/** Supabase PostgREST errors are plain objects rather than Error instances. */
export const errorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
};
