import { PostgrestError } from "@supabase/supabase-js";

import { postgrestErrorCode } from "@/lib/postgrest-error";

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
