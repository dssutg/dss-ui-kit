// SPDX-License-Identifier: MIT
// Checks the Node version the workflow pins matches the one package.json declares.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * The Node version the pipeline installs and the one the package declares are one fact written
 * twice.
 *
 * `NODE_VERSION` in the workflow selects the toolchain every job runs; `engines.node` in
 * `package.json` is what a contributor and a consumer read. The workflow carries a comment telling
 * the reader to keep the two in sync, and a comment is what this replaces: a bumped `engines.node`
 * that leaves the pipeline on the old Node is a build that passes here and fails in the runtime the
 * package says it supports, and it is invisible until something in the newer Node is used.
 *
 * The two files have to agree; neither is derived from the other, and that is why the comparison is
 * a test rather than a build step that copies one into the other.
 */

const WORKFLOW_PATH = '.github/workflows/ci.yml';

/** The value of `NODE_VERSION` in the workflow's `env` block, or `undefined` if it is not there. */
function workflowNodeVersion(): string | undefined {
  const workflow = readFileSync(join(REPOSITORY_ROOT, WORKFLOW_PATH), 'utf8');

  return /^\s*NODE_VERSION:\s*(\S+)\s*$/m.exec(workflow)?.[1];
}

/** The `engines.node` range `package.json` declares. */
function declaredNodeVersion(): string | undefined {
  const manifest = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
    readonly engines?: { readonly node?: string } | undefined;
  };

  return manifest.engines?.node;
}

describe('the Node version', () => {
  it('is declared in both places', () => {
    expect(workflowNodeVersion()).toBeDefined();
    expect(declaredNodeVersion()).toBeDefined();
  });

  it('is the same version in CI and in package.json', () => {
    expect(workflowNodeVersion()).toBe(declaredNodeVersion());
  });
});
