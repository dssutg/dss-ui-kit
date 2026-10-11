/**
 * The test helpers, published as `dss-ui-kit/testing`.
 *
 * They used to re-export from the main entry, which pulled the `@/util/testing/render` module into
 * the published runtime bundle. That module imports `vitest` and calls `afterEach` at module load, so
 * the bundle inlined a second vitest instance and a consumer's own test run — which loads the same
 * module — registered its hooks against the wrong one. The helpers belong to the tests that run them,
 * not to the runtime, so they live on this subpath and the bundle keeps `vitest` external:
 *
 * ```ts
 * import { render, waitFor } from 'dss-ui-kit/testing';
 * ```
 *
 * Importing this entry declares vitest as the runner, which is what these helpers are for.
 */
export * from '@/util/testing/render';
