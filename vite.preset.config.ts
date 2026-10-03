import { defineConfig } from 'vite';

/**
 * The build for the Tailwind preset published as `dss-ui-kit/tailwind`.
 *
 * It is a second Vite build rather than a second entry in `vite.config.ts` because that build emits
 * both ES and UMD, and a UMD build accepts exactly one entry point. The preset does not belong in a
 * UMD bundle either: a script tag loads it as a global, while a Tailwind config is read by the
 * consumer's own toolchain, so an ES module beside the stylesheet is the only shape that is used.
 *
 * `emptyOutDir` is off because this build writes into a `dist/` the library build has already filled,
 * and emptying it here would delete the bundle and the emitted declarations along the way. Order in
 * `deno task build` is what keeps `dist/` correct: the library build empties it, this one adds to it.
 */
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: new URL('./src/tailwind_preset.ts', import.meta.url).pathname,
      formats: ['es'],
      fileName: () => 'tailwind.js',
    },
  },
});
