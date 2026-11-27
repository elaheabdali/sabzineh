import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E (Week 2, catalog flows).
 *
 * Browsers: Chromium + Firefox. The project pins @playwright/test
 * 1.65.1 because its browser revisions match the cached browsers
 * in the dev VM (chromium_headless_shell-1255, firefox-1572).
 *
 * The webServer builds the production app and serves it on :3100;
 * locally an already-running server on :3100 is reused instead.
 */
const PORT = 3100;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: "pnpm build && pnpm start -p 3100",
    url: `${baseURL}/fa`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
