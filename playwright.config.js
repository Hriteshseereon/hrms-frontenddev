// Playwright configuration — end-to-end tests against a production build.
// Build first (npm run build); vite preview below then serves dist/ on :3000.
import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run preview", url: "http://127.0.0.1:3000/login", reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
