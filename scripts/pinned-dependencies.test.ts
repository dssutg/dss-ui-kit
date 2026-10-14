// SPDX-License-Identifier: MIT
// Requires every dependency version in package.json to be pinned exactly.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * A dependency range is a bug, not a convenience.
 *
 * `deno install --frozen` proves the lockfile and `package.json` agree, but a lockfile can agree with
 * a range just as well as with an exact version: `"^2.6.1"` and `"2.6.1"` both install a lock entry,
 * and the range only drifts on the next install, in an environment that is not this one. The two
 * fields a consumer's install resolves are therefore held to an exact version here, where the failure
 * names the dependency rather than surfacing as a version mismatch nobody can see.
 *
 * `peerDependencies` is deliberately not checked: a peer dependency is a promise about which host
 * versions this library works with, so a range is the correct thing to write and an exact pin would
 * reject every compatible Preact.
 */

/** The fields whose versions have to be exact; `peerDependencies` states a compatible range instead. */
const EXACT_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

/** An exact semantic version, including a prerelease and build metadata, and nothing else. */
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** The manifest fields the peer-dependency rules read. */
interface DependencyManifest {
  readonly dependencies?: Readonly<Record<string, string>> | undefined;
  readonly peerDependencies?: Readonly<Record<string, string>> | undefined;
}

/** `package.json`, read for the dependency fields alone. */
function dependencyManifest(): DependencyManifest {
  return JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8'),
  ) as DependencyManifest;
}

/** The version a manifest field declares for `name`, read through a variable so neither the literal
 * key rule nor `noPropertyAccessFromIndexSignature` is at odds with the other. */
function declaredVersion(
  manifest: DependencyManifest,
  field: keyof DependencyManifest,
  name: string,
): string | undefined {
  return manifest[field]?.[name];
}

/** The dependencies whose declared version is a range rather than an exact version. */
function findUnpinned(): string[] {
  const manifest = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
    readonly [field: string]: unknown;
  };
  const unpinned: string[] = [];

  for (const field of EXACT_FIELDS) {
    const dependencies = manifest[field];
    if (dependencies === undefined || dependencies === null || typeof dependencies !== 'object') {
      continue;
    }

    for (const [name, version] of Object.entries(dependencies as Record<string, unknown>)) {
      if (typeof version !== 'string' || !EXACT_VERSION.test(version)) {
        unpinned.push(`${field}: ${name} ${String(version)}`);
      }
    }
  }

  return unpinned.sort();
}

describe('dependency versions', () => {
  it('pins every installable dependency to an exact version', () => {
    expect(findUnpinned()).toEqual([]);
  });
});

/**
 * Preact is the peer the library runs on, and bundling its own copy would put two renderers in one
 * bundle. The two things that make that true are checkable: it is a peer and not a runtime
 * dependency, and the peer it declares is a range so every compatible Preact satisfies it.
 */
describe('the Preact peer dependency', () => {
  it('is declared as a peer and never as a runtime dependency', () => {
    const manifest = dependencyManifest();

    expect(declaredVersion(manifest, 'peerDependencies', 'preact')).toBeDefined();
    expect(declaredVersion(manifest, 'dependencies', 'preact')).toBeUndefined();
  });

  it('states a range rather than an exact version, so any compatible Preact installs', () => {
    const peer = declaredVersion(dependencyManifest(), 'peerDependencies', 'preact');

    expect(peer).toBeTypeOf('string');
    expect(EXACT_VERSION.test(peer ?? '')).toBe(false);
  });
});
