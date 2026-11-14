import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Specs share one local Cloudflare Durable Object matchmaking queue. Parallel
  // files can accidentally join each other's races and corrupt expectations.
  // Keep CI serial; tests within a file already run sequentially.
  workers: process.env.CI ? 1 : undefined,
  // Generated passages are up to ~205 characters; tests type them at human speed.
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: 'npm run dev:web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ]
});
