import { defineConfig } from '@playwright/test';

const PORT = 4318;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  // 2-vCPU runners render SwiftShader WebGL about 8x slower than a dev machine, so a passing template test can take 35s there.
  timeout: process.env.CI ? 90_000 : 30_000,
  // Shared runners occasionally hang while creating a browser context; one retry absorbs that, and the report still marks the test flaky.
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 1000, height: 700 },
    // SwiftShader gives WebGL on CI runners without a GPU and makes renders reproducible.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  // The site tests need http:// (file:// iframes are cross-origin in Chromium); serve-site rebuilds _site first, so `npx playwright test` needs no extra step.
  webServer: {
    command: 'node scripts/serve-site.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
  },
});
