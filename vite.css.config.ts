import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';

/**
 * The build for the stylesheet published as `dss-ui-kit/style.css`.
 *
 * It is a third Vite build rather than part of the library build because the library build only
 * emits a stylesheet when a module imports one, and `src/index.ts` must not: JSR type-checks the
 * package with Deno, which cannot read a CSS module, so the side-effect import is the one line the
 * source cannot spell. Without a build of its own the stylesheet the npm manifest points at
 * (`style`, `exports["./style.css"]`) would simply not exist.
 *
 * The entry is the stylesheet itself and `emptyOutDir` is off for the same reasons as
 * `vite.preset.config.ts`: the library build has already filled `dist/`, and emptying it here would
 * delete the bundle and the emitted declarations along the way. Order in `deno task build` is what
 * keeps `dist/` correct: the library build empties it, this one adds to it.
 */
export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: new URL('./src/index.css', import.meta.url).pathname,
      output: {
        // One stylesheet, named after the package rather than the entry file. The JS chunk a CSS
        // entry also produces is an empty module; it is named out of the way rather than deleted,
        // because deleting it would mean removing the file in a hook after the build.
        assetFileNames: () => 'dss-ui-kit.css',
        entryFileNames: () => 'dss-ui-kit.css.js',
      },
    },
  },
});
