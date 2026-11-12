import {
  createHomeSchema,
  HOME_NAME_MAX_LENGTH,
  HOME_NAME_TOO_LONG_MESSAGE,
} from "@/lib/schemas/home";

// Every message produced for `name`, so a case asserts what a user would see
// rather than just that the parse failed.
const nameErrors = (name: string) => {
  const result = createHomeSchema.safeParse({ name });

  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("# home schemas", () => {
  describe("## createHomeSchema", () => {
    it("accepts a name", () => {
      expect(nameErrors("Lake House")).toEqual([]);
    });

    it("rejects an empty name", () => {
      expect(nameErrors("")).toEqual(["Enter a name for your home."]);
    });

    it("rejects a name that is only spaces", () => {
      expect(nameErrors("   ")).toEqual(["Enter a name for your home."]);
    });

    it("accepts a name at the maximum length", () => {
      expect(nameErrors("a".repeat(HOME_NAME_MAX_LENGTH))).toEqual([]);
    });

    it("rejects a name one character over the maximum", () => {
      expect(nameErrors("a".repeat(HOME_NAME_MAX_LENGTH + 1))).toEqual([
        HOME_NAME_TOO_LONG_MESSAGE,
      ]);
    });

    // `create_home` trims before it stores, so the spaces are not part of the
    // name and must not push it over the limit.
    it("does not count spaces around the name toward its length", () => {
      expect(nameErrors(`  ${"a".repeat(HOME_NAME_MAX_LENGTH)}  `)).toEqual([]);
    });

    it("returns the name trimmed", () => {
      expect(createHomeSchema.parse({ name: "  Lake House  " })).toEqual({ name: "Lake House" });
    });
  });
});
