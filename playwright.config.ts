import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  tsconfig: './tsconfig.e2e.json',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080/flowstack',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:8080',
    reuseExistingServer: true,
  },
});
