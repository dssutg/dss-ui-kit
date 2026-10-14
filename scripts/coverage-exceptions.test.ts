import { describe, expect, test } from 'vitest';
import { COVERAGE_EXCEPTIONS } from './coverage-exceptions.ts';
import { collectFiles } from './util/source-tree.ts';

/**
 * Every coverage exception names a file that exists and says why.
 *
 * The gate in `vitest.config.ts` holds `src/` to 100% and the exception list is the one way a
 * file leaves it. A list nobody checks is a list that grows: an entry left behind after its file was
 * renamed silently excludes nothing, and an entry with no reason is indistinguishable from gaming
 * the number. This test reads the list rather than the coverage report — it cannot know the file is
 * genuinely uncovered, only that the entry is a real, justified exception to a real file.
 */

/** A glob of the two forms the exceptions use: a double-star tail for a subtree, a star in a segment. */
function globToRegExp(pattern: string): RegExp {
  const segments = pattern.split('/').map((segment) => {
    if (segment === '**') {
      return '.*';
    }

    return segment.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '[^/]*');
  });

  return new RegExp(`^${segments.join('/')}$`);
}

describe('coverage exceptions', () => {
  test('every exception names at least one file', () => {
    const files = collectFiles('src');

    const unmatched = COVERAGE_EXCEPTIONS.filter((exception) => {
      const pattern = globToRegExp(exception.path);

      return !files.some((file) => pattern.test(file));
    }).map((exception) => exception.path);

    expect(unmatched).toEqual([]);
  });

  test('every exception states a reason', () => {
    const unexplained = COVERAGE_EXCEPTIONS.filter(
      (exception) => exception.reason.trim() === '',
    ).map((exception) => exception.path);

    expect(unexplained).toEqual([]);
  });

  test('every exception is inside the covered directory', () => {
    const outside = COVERAGE_EXCEPTIONS.filter(
      (exception) => !exception.path.startsWith('src/'),
    ).map((exception) => exception.path);

    expect(outside).toEqual([]);
  });
});
