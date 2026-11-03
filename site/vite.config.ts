import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset URLs keep the build working from any path, on any host, at any path.
  base: './',
  build: {
    target: 'es2024',
    // MapLibre GL is one large, self-contained chunk; this is expected.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
