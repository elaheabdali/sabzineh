import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Shared ESLint flat-config preset for the sabzineh monorepo.
 * Extends the Next.js core-web-vitals + TypeScript presets.
 */
export const baseConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/coverage/**",
    "next-env.d.ts",
  ]),
]);

export default baseConfig;
