import { defineConfig } from "oxfmt";

export default defineConfig({
  sortImports: {
    groups: [
      "type-import",
      ["value-builtin", "value-external"],
      "type-internal",
      "value-internal",
      ["type-parent", "type-sibling", "type-index"],
      ["value-parent", "value-sibling", "value-index"],
      "unknown",
    ],
  },
  sortTailwindcss: {
    // Not global.css: its tokens live in uniwind @variant blocks the sorter
    // can't read. See the header comment in oxfmt-tailwind.css.
    stylesheet: "./apps/supplystash/oxfmt-tailwind.css",
    functions: ["clsx", "cn"],
    preserveWhitespace: true,
  },
});
