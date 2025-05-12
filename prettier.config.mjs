export default {
  singleQuote: false,
  trailingComma: "es5",
  tabWidth: 2,
  semi: true,
  jsxSingleQuote: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",
  singleAttributePerLine: true,
  plugins: [
    "prettier-plugin-tailwindcss",
    "@trivago/prettier-plugin-sort-imports",
  ],
  importOrder: [
    "^@/constants/(.*)$",
    "^@/stores/(.*)$",
    "^@/types/(.*)$",
    "^@/components/(.*)$",
    "^[./]",
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
