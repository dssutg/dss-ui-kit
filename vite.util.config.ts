// SPDX-License-Identifier: MIT
// The build of the React-free helpers published as dss-ui-kit/util.

import { defineConfig } from 'vite';

/**
 * The build for the React-free helpers published as `dss-ui-kit/util`.
 *
 * It mirrors the testing build rather than a second entry in `vite.config.ts` for the same reason
 * that one states: the library build emits both ES and UMD, and a UMD build accepts exactly one
 * entry point. The helpers belong in a UMD bundle even less than the testing helpers — their
 * consumer is a Node process that imports ES modules — so an ES module beside the main bundle is
 * the only shape that is used.
 *
 * The alias map is repeated rather than shared: `vite.config.ts` does not export it, and this build
 * stands on its own whether or not the library build changes.
 *
 * `emptyOutDir` is off for the same reason as the preset and testing builds: this build writes into
 * a `dist/` the library build has already filled. Order in `npm run build` is what keeps `dist/`
 * correct.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: new URL('./src/util/index.ts', import.meta.url).pathname,
      formats: ['es'],
      fileName: () => 'util.js',
    },
  },
});
