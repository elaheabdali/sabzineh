import { defineConfig, globalIgnores } from "eslint/config";
import { baseConfig } from "../../packages/config/eslint/index.mjs";

export default defineConfig([
  ...baseConfig,
  globalIgnores(["next-env.d.ts", ".next/**", "out/**", "build/**"]),
]);
