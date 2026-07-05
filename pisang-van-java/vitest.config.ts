import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    exclude: ['node_modules', '.next', 'playwright-tests', 'e2e'],
    // ADDITION (QA & Security): reporting coverage supaya persentase terlihat di CI.
    // Tidak diberi `thresholds` global dulu — coverage saat ini belum diukur baseline-nya
    // (banyak area seperti /api/pos, /api/admin belum punya test). Setelah baseline
    // terukur dari hasil CI pertama, tambahkan `thresholds: { lines, functions, ... }`
    // di sini supaya coverage tidak boleh turun dari baseline tersebut (ratchet up).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '.next/',
        'e2e/',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        'prisma/seed.ts'
      ]
    },
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
