import { defineConfig } from 'vitest/config';

// Testes unitários (regras puras de lib/) e de banco (schema.sql real em PGlite).
// Os E2E ficam em e2e/ e rodam com Playwright (npm run test:e2e).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
