import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@sabzineh/ui",
        replacement: path.resolve(root, "packages/ui/src/index.ts"),
      },
      {
        find: "@sabzineh/types",
        replacement: path.resolve(root, "packages/types/src/index.ts"),
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(root, "apps/web/src/$1") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/*/src/**/*.test.{ts,tsx}", "apps/web/src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,tsx}", "apps/web/src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/node_modules/**"],
    },
  },
});
