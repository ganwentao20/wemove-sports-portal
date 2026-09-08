import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "https://127.0.0.1:3443",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/performance.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: "**/performance.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: "**/performance.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
    { name: "performance", testMatch: "**/performance.spec.ts" },
  ],
  webServer: [
    {
      command: "node apps/api/dist/main.js",
      url: "http://127.0.0.1:8080/api/v1/health/ready",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: "development",
        PORT: "8080",
        APP_BASE_URL: "https://127.0.0.1:3443",
        NOTIFICATION_WORKER: "false",
      },
    },
    {
      command: "npm run start -w web -- --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: "node scripts/browser-https.mjs",
      url: "https://127.0.0.1:3443",
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
