import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/types/**',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/__tests__/**',
        'src/theme.ts',
        'src/App.tsx',
        'src/routes/**',
        'src/components/MarkdownRenderer.tsx',
        'src/components/SignInDialog.tsx',
        'src/contexts/**',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
})
