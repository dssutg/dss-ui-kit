// SPDX-License-Identifier: MIT
// The build of the test helpers published as dss-ui-kit/testing.

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

/**
 * The build for the test helpers published as `dss-ui-kit/testing`.
 *
 * It mirrors the Tailwind preset build rather than a second entry in `vite.config.ts` for the same
 * reason that one states: the library build emits both ES and UMD, and a UMD build accepts exactly
 * one entry point. The test helpers do not belong in a UMD bundle either — nothing loads them as a
 * global — so an ES module beside the main bundle is the only shape that is used.
 *
 * `vitest` is external here, not external by accident: the helpers call `afterEach` at module load,
 * and that hook has to register against the consumer's own vitest instance or a suite that imports
 * the helpers fails on a vitest it never started. The `react`/`preact` family is external the same
 * way and meant the same way as in the library build — the helpers render through
 * `preact/compat`, and a consumer's bundle must contain the one Preact the hooks run against.
 *
 * The alias map is repeated rather than shared: `vite.config.ts` does not export it, and the testing
 * build stands on its own whether or not the library build changes.
 *
 * `emptyOutDir` is off for the same reason as the preset build: this build writes into a `dist/` the
 * library build has already filled. Order in `npm run build` is what keeps `dist/` correct.
 */
export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom/client': 'preact/compat/client',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-runtime',
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: new URL('./src/testing.ts', import.meta.url).pathname,
      formats: ['es'],
      fileName: () => 'testing.js',
    },
    rollupOptions: {
      external: [
        'preact',
        'preact/compat',
        'preact/hooks',
        'preact/jsx-runtime',
        'react',
        'react-dom',
        /^react\//,
        /^react-dom\//,
        'vitest',
      ],
    },
  },
});
