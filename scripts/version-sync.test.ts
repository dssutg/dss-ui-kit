import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The Deno version the pipeline installs and the one the package declares are one fact written
 * twice.
 *
 * `DENO_VERSION` in the workflow selects the toolchain every job runs; `engines.deno` in
 * `package.json` is what a contributor and a consumer read. The workflow carries a comment telling
 * the reader to keep the two in sync, and a comment is what this replaces: a bumped `engines.deno`
 * that leaves the pipeline on the old Deno is a build that passes here and fails in the runtime the
 * package says it supports, and it is invisible until something in the newer Deno is used.
 *
 * The two files have to agree; neither is derived from the other, and that is why the comparison is
 * a test rather than a build step that copies one into the other.
 */

const WORKFLOW_PATH = '.github/workflows/ci.yml';

/** The value of `DENO_VERSION` in the workflow's `env` block, or `undefined` if it is not there. */
function workflowDenoVersion(): string | undefined {
  const workflow = readFileSync(join(REPOSITORY_ROOT, WORKFLOW_PATH), 'utf8');

  return /^\s*DENO_VERSION:\s*(\S+)\s*$/m.exec(workflow)?.[1];
}

/** The `engines.deno` range `package.json` declares. */
function declaredDenoVersion(): string | undefined {
  const manifest = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
    readonly engines?: { readonly deno?: string } | undefined;
  };

  return manifest.engines?.deno;
}

describe('the Deno version', () => {
  it('is declared in both places', () => {
    expect(workflowDenoVersion()).toBeDefined();
    expect(declaredDenoVersion()).toBeDefined();
  });

  it('is the same version in CI and in package.json', () => {
    expect(workflowDenoVersion()).toBe(declaredDenoVersion());
  });
});
