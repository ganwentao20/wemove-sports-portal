import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Exercise the running local app without starting a second API during hot reload. */
export default defineConfig({
  ...base,
  testMatch:
    /(?:ui-locale|i18n-public|catalog-locale|account-dealer-locale|i18n-admin)\.spec\.ts$/,
  projects: base.projects?.filter((project) => project.name !== "performance"),
  outputDir: "test-results/locale",
  use: {
    ...base.use,
    baseURL: process.env.WEMOVE_LOCALE_BASE_URL ?? "http://localhost:3000",
  },
  webServer: [],
});
