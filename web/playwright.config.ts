import { defineConfig, devices } from '@playwright/test';

// Pruebas de extremo a extremo: recorren la aplicación como una persona, en
// móvil y en escritorio, contra el servidor de desarrollo.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://localhost:5177', locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  webServer: { command: './node_modules/.bin/vite --port 5177 --strictPort', url: 'http://localhost:5177', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    { name: 'movil', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'movil-oscuro', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', colorScheme: 'dark' } },
  ],
});
