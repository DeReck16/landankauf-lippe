import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Erklärfilm: Quellen sind Szenen-Schnipsel ohne Imports (werden von
    // scripts/erklaerfilm-bauen.mjs zu public/video/film.js zusammengesetzt),
    // public/video enthält gebautes und fremdes (React) JavaScript.
    "video-quelle/**",
    "public/video/**",
  ]),
]);

export default eslintConfig;
