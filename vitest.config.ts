import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * The test environment.
 *
 * Merged from `vite.config.ts` rather than configured twice, so the `@` alias and the
 * `preact/compat` mappings a test renders through are the same ones the library build uses. A test
 * that resolved `react` differently from the build would pass here and fail in a consumer's bundle.
 *
 * The default is `node`, not `jsdom`, and a component test asks for the DOM it needs with a
 * `// @vitest-environment jsdom` line at the top of the file. That is not only a speed argument: jsdom
 * replaces the global `URL` and `document`, so a suite that walks the filesystem or builds a URL under
 * jsdom exercises a different runtime from the one it ships in, and it will pass where the same code
 * fails in node. The repository-policy tests have no business in a DOM, and the render tests in
 * `TODO.md` stage 11 get their environment declared in the file that needs it.
 */
export default defineConfig(
  mergeConfig(viteConfig, {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
      // Loaded for every environment, and a no-op in the ones that need nothing: the browser APIs jsdom
      // does not implement are listed there rather than in each test file that trips over one.
      setupFiles: ['./src/lib/testing/setup.ts'],
    },
  }),
);
