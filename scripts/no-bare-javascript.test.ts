import { describe, expect, it } from 'vitest';
import { collectFiles } from './util/source-tree.ts';

/**
 * This project is written in TypeScript. Bare JavaScript is allowed only inside dependencies, which
 * this repository does not own, so a `.js` file in the tree is always something the project itself
 * introduced — and it would arrive without the types and the strictness everything else is held
 * to. The rule is easy to state and easy to break by accident, so it is checked here rather than
 * left to review: this runs as part of `deno task ci`.
 */

/** Every spelling of a JavaScript file, including the module and CommonJS extensions. */
const JAVASCRIPT_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs'];

describe('repository policy', () => {
  it('contains no bare JavaScript', () => {
    const bareJavaScript = collectFiles().filter((path) =>
      JAVASCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension)),
    );

    expect(bareJavaScript).toEqual([]);
  });
});
