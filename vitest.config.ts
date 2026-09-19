import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" path alias so tests can import modules that
      // reference it transitively (e.g. lib/super-session → @/lib/prisma).
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // Unit + DB-backed integration tests for security/business logic.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
