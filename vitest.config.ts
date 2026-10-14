import { defineConfig, mergeConfig } from 'vitest/config';
import { COVERAGE_EXCEPTIONS } from './scripts/coverage-exceptions.ts';
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
 * fails in node. The repository-policy tests have no business in a DOM, and a render test asks for
 * its environment in the file that needs it.
 */
export default defineConfig(
  mergeConfig(viteConfig, {
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
      // Loaded for every environment, and a no-op in the ones that need nothing: the browser APIs jsdom
      // does not implement are listed there rather than in each test file that trips over one.
      setupFiles: ['./src/util/testing/setup.ts'],
      // The repository-policy tests parse the whole source tree with the TypeScript scanner, which
      // is a few seconds of a single worker's time in an empty runner but competes for cores with
      // every other worker in a loaded coverage run — the default 5s made one of them report a
      // failure that was only a slow machine. The budget is for the scan, not an excuse for a hung
      // test: a genuinely stuck test still fails the suite, just later.
      testTimeout: 10_000,
      coverage: {
        provider: 'v8',
        // The whole library is what the gate covers: the helpers under `src/util/`, the components
        // under `src/components/`, and the infrastructure modules beside them. The one layer left out
        // is the testing helpers, listed as an exception below.
        include: ['src/**/*.{ts,tsx}'],
        // A test is not something to cover, and a shader is not TypeScript. The exceptions are read
        // from the list whose reasons are checked by `scripts/coverage-exceptions.test.ts`.
        exclude: [
          'src/**/*.test.{ts,tsx}',
          ...COVERAGE_EXCEPTIONS.map((exception) => exception.path),
        ],
        reporter: ['text'],
        // The whole gate: a partial threshold is met by covering the easy half, which is the number
        // this repository refuses to game. Exceptions belong in the list above, with a reason.
        thresholds: {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  }),
);
