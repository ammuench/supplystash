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

// PostgREST is up but cannot reach Postgres: to the user, the server is
// unreachable. A pattern, not a list, because both are documented by group:
// PostgREST codes are `PGRSTgxx` with group 0 = database connection (503/504),
// and SQLSTATE class 08 is a Postgres connection exception (503).
const DATABASE_UNREACHABLE = /^(PGRST0\d\d|08[0-9A-Z]{3})$/;

/** Whether a failed request never got a real answer from the server, which is
 * what the "Can't reach the server" bar reports (architecture §5.6). With
 * `.throwOnError()`, a fetch that throws (no route, DNS, a captive portal
 * cutting TLS) rejects with the raw error, which has no code. A body that is
 * not PostgREST JSON (a portal's HTML login page) becomes a PostgrestError
 * with an empty or missing code. Any other code means the server answered and
 * refused, such as an RLS denial, and the bar would name the wrong cause. See
 * docs/connectivity.md.
 */
export const isNetworkFailure = (error: unknown) => {
  const code = postgrestErrorCode(error);

  return !code || DATABASE_UNREACHABLE.test(code);
};
