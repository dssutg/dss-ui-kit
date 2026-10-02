import preact from '@preact/preset-vite';
import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  // The PostCSS pipeline is declared here rather than in a `postcss.config.js`. A root-level
  // JavaScript config would be the only bare `.js` file in the repository, which this project
  // forbids; declaring it in TypeScript keeps the build configuration typed and in one place.
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
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
  optimizeDeps: {
    include: ['preact', 'preact/compat', 'preact/hooks', 'preact/jsx-runtime'],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    // A library build, not an application build. `src/index.ts` is the single public surface; the
    // peer dependencies stay external so a consumer's bundle contains one Preact rather than two,
    // which would break hooks across the boundary.
    lib: {
      entry: new URL('./src/index.ts', import.meta.url).pathname,
      name: 'DssUiKit',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'umd' ? 'dss-ui-kit.umd.cjs' : 'dss-ui-kit.js'),
    },
    rollupOptions: {
      // The globals the UMD build reads off `window` for each external. Rollup guesses at these
      // from the module id and warns when it does, which would leave a script-tag consumer with a
      // global named `preact_jsx_runtime` that nothing sets. One Preact on the page is what every
      // format here expects: Preact's own UMD builds expose `preact`, `preactHooks` and
      // `preactCompat`.
      output: {
        globals: {
          react: 'preact',
          'react-dom': 'preactCompat',
          'react-dom/client': 'preactCompat',
          'react/jsx-runtime': 'preact',
          'react/jsx-dev-runtime': 'preact',
          preact: 'preact',
          'preact/hooks': 'preactHooks',
          'preact/compat': 'preactCompat',
          'preact/jsx-runtime': 'preact',
        },
      },
      // The whole `react` family is external for the same reason as `preact`: the library is
      // written against the React API and resolved through `preact/compat` at the consumer's end.
      external: [
        'preact',
        'preact/compat',
        'preact/hooks',
        'preact/jsx-runtime',
        'react',
        'react-dom',
        /^react\//,
        /^react-dom\//,
      ],
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
});
