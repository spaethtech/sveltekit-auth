import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    rollupOptions: {
      // Externalize optional dependencies
      external: ['@node-rs/argon2']
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
