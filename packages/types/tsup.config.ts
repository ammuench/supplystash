import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: ["src/index.ts", "src/db-schema.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
});
