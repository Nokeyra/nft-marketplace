import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: 'e2e', fullyParallel: true, retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'mobile-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],

  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
})
