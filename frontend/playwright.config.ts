import { defineConfig, devices } from '@playwright/test';

// E2E da Aula 05. Por padrão sobe:
//  1) um banco de TESTE local (schema.sql + seed.sql reais em PGlite, API igual
//     à do Supabase) em :54321 — nunca o banco de produção;
//  2) o front (Vite) apontando para ele em :5174.
// Para rodar contra outro Supabase de teste (ex.: `supabase start`), defina
// E2E_SUPABASE_URL e E2E_SUPABASE_ANON_KEY — os testes que resetam o banco
// local (/__reset) só funcionam no modo padrão.
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? 'chave-local-de-teste';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // um único banco de teste compartilhado: execução serial
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'], launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {} } },
  ],
  webServer: [
    ...(process.env.E2E_SUPABASE_URL
      ? []
      : [{ command: 'node e2e/support/fake-supabase.mjs', url: 'http://localhost:54321/__reset', reuseExistingServer: true, timeout: 60_000 }]),
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      env: { VITE_SUPABASE_URL: SUPABASE_URL, VITE_SUPABASE_ANON_KEY: SUPABASE_KEY },
      timeout: 60_000,
    },
  ],
});
