/// <reference types="nativewind/types" />
declare module "*.css";

// nativewind@4.2.6 ships an empty dist/tailwind/index.d.ts, so the preset has no type.
declare module "nativewind/preset" {
  const preset: import("tailwindcss").Config;
  export default preset;
}
