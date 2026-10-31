import { PostgrestError } from "@supabase/supabase-js";

import { isNetworkFailure, postgrestErrorCode } from "@/lib/postgrest-error";

describe("# postgrestErrorCode", () => {
  it("reads the code off a PostgrestError", () => {
    const error = new PostgrestError({
      message: "new row violates row-level security policy",
      details: "",
      hint: "",
      code: "42501",
    });

    expect(postgrestErrorCode(error)).toBe("42501");
  });

  it("reads the code off a plain object with the same shape", () => {
    expect(postgrestErrorCode({ code: "PGRST116" })).toBe("PGRST116");
  });

  it.each([
    ["a plain Error", new Error("Network request failed")],
    ["a non-string code", { code: 500 }],
    ["null", null],
    ["a string", "boom"],
  ])("returns undefined for %s", (_, error) => {
    expect(postgrestErrorCode(error)).toBeUndefined();
  });
});

const postgrestError = (code: string | undefined) =>
  new PostgrestError({ message: "", details: "", hint: "", code: code as string });

describe("# isNetworkFailure", () => {
  // The shapes supabase-js produces under `.throwOnError()`; see
  // docs/connectivity.md.
  it.each([
    ["a thrown fetch error", new TypeError("Network request failed")],
    ["a non-JSON error body (portal redirect page)", postgrestError(undefined)],
    ["a non-JSON 200 body (portal login page)", postgrestError("")],
    ["PostgREST unable to reach Postgres", postgrestError("PGRST000")],
    ["PostgREST losing its Postgres connection", postgrestError("PGRST001")],
    ["PostgREST without a schema cache", postgrestError("PGRST002")],
    ["PostgREST timing out on its connection pool", postgrestError("PGRST003")],
    ["a Postgres connection exception", postgrestError("08006")],
  ])("is true for %s", (_, error) => {
    expect(isNetworkFailure(error)).toBe(true);
  });

  it.each([
    ["an RLS denial", postgrestError("42501")],
    ["a missing row", postgrestError("PGRST116")],
    ["an expired JWT", postgrestError("PGRST303")],
    ["a PostgREST request error outside the connection group", postgrestError("PGRST100")],
  ])("is false for %s", (_, error) => {
    expect(isNetworkFailure(error)).toBe(false);
  });
});
