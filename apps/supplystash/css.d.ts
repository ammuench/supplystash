// The side-effect import of @/global.css needs a module declaration. Expo
// generates one into the untracked expo-env.d.ts / .expo/types, so a clean
// checkout (CI) fails TS2882 without this committed fallback.
declare module "*.css";
