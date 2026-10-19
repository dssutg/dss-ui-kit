// SPDX-License-Identifier: MIT
// Holds the checks the ci task and the CI jobs run to one list.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from './util/source-tree.ts';

/**
 * `npm run ci` runs everything CI runs.
 *
 * The pipeline keeps one gate on purpose: a green `npm run ci` and a green CI mean the same thing.
 * That is only true while the two lists agree, and nothing made them — a command added to a job and
 * not to the script is a check a contributor never runs, and one added to the script and not to a job
 * is a local failure CI would not report. Both files are read here and the workflow's commands are
 * required to be a subset of what `ci` runs, which is the direction that matters: the script may run
 * more (it bundles `lint` where CI splits `lint:biome` and `typecheck`), but a job may not run
 * something the local gate does not.
 *
 * Each side is expanded to its leaf commands through the `npm run` graph, so `lint` counts as the
 * three commands it chains rather than as the word. Comments are stripped first, because the
 * workflow's own prose names scripts, and a mention is not a step.
 */

const WORKFLOW_PATH = '.github/workflows/ci.yml';
const SETUP_ACTION_PATH = '.github/actions/setup/action.yml';

/** The `scripts` table of `package.json`, by script name. */
function scripts(): Readonly<Record<string, string>> {
  const manifest = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
    readonly scripts?: Readonly<Record<string, string>> | undefined;
  };

  return manifest.scripts ?? {};
}

/** The leaf commands a script runs, following every `npm run` reference it makes. */
function leafCommands(name: string, seen: readonly string[] = []): string[] {
  if (seen.includes(name)) {
    return [];
  }

  const command = scripts()[name];

  if (command === undefined) {
    return [];
  }

  const references = [...command.matchAll(/npm run ([\w:-]+)/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );

  if (references.length === 0) {
    return [command];
  }

  return references.flatMap((reference) => leafCommands(reference, [...seen, name]));
}

/** A workflow file with its full-line comments removed, so prose is not read as a step. */
function withoutComments(path: string): string {
  return readFileSync(join(REPOSITORY_ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Every `npm` command a workflow file runs, as script names and literal commands. */
function workflowCommands(): string[] {
  const text = [withoutComments(WORKFLOW_PATH), withoutComments(SETUP_ACTION_PATH)].join('\n');
  const commands = [...text.matchAll(/npm run ([\w:-]+)/g)].flatMap((match) =>
    match[1] === undefined ? [] : [`script:${match[1]}`],
  );

  if (text.includes('npm ci')) {
    commands.push('ci');
  }

  return commands;
}

/** The leaf commands of one `npm` command a workflow runs. */
function leavesOf(command: string): string[] {
  return command.startsWith('script:')
    ? leafCommands(command.slice('script:'.length))
    : [`npm ${command}`];
}

describe('the continuous integration pipeline', () => {
  it('runs nothing that `npm run ci` does not run', () => {
    const ciLeaves = new Set(leafCommands('ci'));
    const missing = workflowCommands()
      .flatMap(leavesOf)
      .filter((command) => !ciLeaves.has(command));

    expect(missing).toEqual([]);
  });

  it('has a `ci` script and a workflow that both contribute commands', () => {
    // Guards the test above against passing for the trivial reason that one side expanded to
    // nothing: a workflow nothing was read from, or a `ci` script that chains no leaf command, would
    // make the subset check vacuous.
    expect(leafCommands('ci').length).toBeGreaterThan(0);
    expect(workflowCommands().length).toBeGreaterThan(0);
  });
});
