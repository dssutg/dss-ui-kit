import { readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/**
 * The root of the repository, derived from this file's own location so that a test does not have to
 * know how deep it sits in the tree.
 *
 * `import.meta.dirname` is used rather than `import.meta.url` on purpose. A test file may opt into
 * the `jsdom` environment, and jsdom replaces the global `URL` with an implementation that resolves a
 * relative reference against the document instead of the module — so `new URL('../..', import.meta.url)`
 * comes back as an `http://localhost` URL here and `fileURLToPath` throws "The URL must be of scheme
 * file". A directory path is what this actually wants, and it is the same whichever environment the
 * caller runs in.
 */
export const REPOSITORY_ROOT = dirname(dirname(import.meta.dirname));

/**
 * Directories this project does not own, as repository-relative paths.
 *
 * Dependencies are the stated exception. The rest are generated or VCS metadata, none of which are
 * sources. Note that only `docs/api` is excluded rather than all of `docs`, so a stray script
 * placed beside the specifications is still collected.
 */
export const IGNORED_PATHS = [
  '.deno',
  '.git',
  '.vite',
  'coverage',
  'dist',
  'docs/api',
  'node_modules',
];

/** Rewrites a path with forward slashes so the comparisons below are platform independent. */
function toPosixPath(path: string): string {
  return path.split(sep).join('/');
}

/** Recursively collects the files below a directory, ignoring the paths we do not own. */
function collectFilesIn(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const relativePath = toPosixPath(relative(REPOSITORY_ROOT, absolute));

    if (IGNORED_PATHS.includes(relativePath)) continue;

    if (entry.isDirectory()) {
      found.push(...collectFilesIn(absolute));
      continue;
    }

    found.push(relativePath);
  }

  return found;
}

/**
 * Every file this project owns, as sorted repository-relative paths with forward slashes.
 *
 * The result is sorted so that a test failure names the offending file in a stable order rather
 * than in whatever order the filesystem happened to return. `node_modules` and the other ignored
 * paths are left out, which is what makes the list a list of *our* files.
 *
 * @param directory - Where to start; the repository root by default.
 * @returns The repository-relative path of every file below `directory`.
 */
export function collectFiles(directory: string = REPOSITORY_ROOT): string[] {
  return collectFilesIn(directory).sort();
}
