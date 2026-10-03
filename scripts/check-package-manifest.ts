#!/usr/bin/env -S deno run --allow-read
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * Checks that every path the package manifest points at exists in the build output.
 *
 * A library's manifest is the part of it a consumer never sees the source of, so a stale path in
 * it is invisible until someone installs the package and their bundler fails on an import. That is
 * a bad time to find out — the library built, the tests passed, and CI was green. This check runs
 * immediately after `deno task build` so the failure lands here instead.
 *
 * It checks the fields a consumer's resolver actually reads: `main`, `module`, `types`, `style`, and
 * every string in the `exports` map. It does not check that the files are correct, only that they
 * are there.
 */

interface PackageManifest {
  readonly main?: string;
  readonly module?: string;
  readonly types?: string;
  readonly style?: string;
  readonly exports?: Readonly<Record<string, unknown>>;
}

/** Every path in the manifest, de-duplicated. Nested `exports` conditions are flattened away. */
function collectManifestPaths(manifest: PackageManifest): string[] {
  const paths = [manifest.main, manifest.module, manifest.types, manifest.style].filter(
    (path): path is string => typeof path === 'string',
  );

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      paths.push(value);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const nested of Object.values(value)) walk(nested);
    }
  };

  walk(manifest.exports);

  return [...new Set(paths)];
}

/** The manifest paths that do not exist, as repository-relative paths for the report. */
function findMissingPaths(): string[] {
  const manifest = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  ) as PackageManifest;

  return collectManifestPaths(manifest)
    .filter((path) => !existsSync(join(REPOSITORY_ROOT, path)))
    .sort();
}

if (import.meta.main) {
  const missing = findMissingPaths();

  if (missing.length > 0) {
    console.error('package.json points at files that the build did not produce:');
    for (const path of missing) console.error(`  - ${path}`);
    console.error('');
    console.error('Run `deno task build` first. If the build succeeded, the manifest is wrong.');
    Deno.exit(1);
  }

  console.log('package.json: every path in the manifest exists in dist/');
}
