/** The stable code on a PostgREST failure: a Postgres SQLSTATE (`42501` = RLS
 * denied) or a PostgREST code (`PGRST116` = no row). Rejection toasts branch on
 * it to tell a deleted row from a lost membership (architecture §5.6), so an
 * offline-capable mutationFn must throw the PostgrestError itself, via
 * supabase-js `.throwOnError()`, rather than wrapping its message in a new
 * Error. Duck-typed rather than `instanceof`, so it also reads a plain object
 * carrying the same field.
 */
export const postgrestErrorCode = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
