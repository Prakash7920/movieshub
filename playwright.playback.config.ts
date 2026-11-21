import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["playback-*-mocked.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      HOSTNAME: "127.0.0.1",
      PORT: "3000",
      // These synthetic values enable only the server-rendered player path.
      // The test intercepts every playback-grant and CDN request.
      CLOUDFLARE_STREAM_ENABLED: "true",
      CLOUDFLARE_PLAYBACK_ENABLED: "true",
      CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
      CLOUDFLARE_STREAM_API_TOKEN: "mock-only-never-used",
      CLOUDFLARE_STREAM_CUSTOMER_CODE: "mockcustomer",
    },
  },
});
