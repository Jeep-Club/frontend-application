import { defineConfig, devices } from "@playwright/test";
import { readLocalUrl } from "./config/local-urls.cjs";

const appUrl = readLocalUrl("PLAYWRIGHT_APP_URL");
const storybookUrl = readLocalUrl("PLAYWRIGHT_STORYBOOK_URL");
const isolatedApiUrl = readLocalUrl("PLAYWRIGHT_API_URL");

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: process.env.TEST_DOCS_OUTPUT ? `${process.env.TEST_DOCS_OUTPUT}/test-results` : "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: appUrl.origin,
    locale: "pt-BR",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [...[
    { browser: "chromium", device: "Desktop Chrome" },
    { browser: "firefox", device: "Desktop Firefox" },
    { browser: "webkit", device: "Desktop Safari" },
  ].flatMap(({ browser, device }) => [
    { name: "mobile", viewport: { width: 375, height: 812 } },
    { name: "tablet", viewport: { width: 768, height: 1024 } },
    { name: "desktop", viewport: { width: 1440, height: 900 } },
  ].map(({ name, viewport }) => ({
    name: `${browser}-${name}`,
    testIgnore: "**/*.a11y.spec.ts",
    use: { ...devices[device], viewport },
  }))), ...[
    { name: "desktop", viewport: { width: 1440, height: 900 } },
    { name: "mobile", viewport: { width: 375, height: 812 } },
  ].map(({ name, viewport }) => ({
    name: `a11y-chromium-${name}`,
    testMatch: "**/*.a11y.spec.ts",
    use: { ...devices["Desktop Chrome"], viewport },
  }))],
  webServer: [
    {
      command: `node node_modules/next/dist/bin/next dev --hostname ${appUrl.hostname} --port ${appUrl.port}`,
      url: new URL("/login", appUrl).href,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        APP_URL: appUrl.origin,
        API_URL: isolatedApiUrl.origin,
        API_FRONTEND_KEY: "playwright-local-only",
        ACCESS: "playwright-local-session-not-for-production",
        NODE_SECURE: "HTTP",
        JEEP_PLAYWRIGHT: "1",
      },
    },
    {
      command: `node node_modules/storybook/dist/bin/dispatcher.js dev --host ${storybookUrl.hostname} --port ${storybookUrl.port} --ci --no-open --disable-telemetry`,
      url: new URL("/index.json", storybookUrl).href,
      timeout: 180_000,
      reuseExistingServer: process.env.PLAYWRIGHT_EXTERNAL_STORYBOOK === '1',
      env: { STORYBOOK_URL: storybookUrl.origin },
    },
  ],
});
