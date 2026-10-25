// SPDX-License-Identifier: MIT
/**
 * The React-free helpers, published as `dss-ui-kit/util`.
 *
 * The package's root entry is the component library: importing it pulls in the Preact peer and the
 * whole component tree with it, and a Node process has neither. The pure helpers a server imports
 * ride this subpath, whose module graph touches nothing outside `src/util/`:
 *
 * ```ts
 * import { errorMessage, fromBase64Url, toBase64Url } from 'dss-ui-kit/util';
 * ```
 *
 * Everything on this barrel must import cleanly where React does not exist. A helper that reaches
 * a component, the locale or any browser-only module belongs on the root entry instead, and adding
 * one here is a deliberate decision about what a Node process may carry.
 */
export * from '@/util/base64url';
export * from '@/util/error_message';
