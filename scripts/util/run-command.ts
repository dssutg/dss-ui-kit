// SPDX-License-Identifier: MIT
// The one place a script runs a subprocess, so the invocation is written once.

import type { SpawnSyncReturns } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { REPOSITORY_ROOT } from './source-tree.ts';

/**
 * Runs a command and captures what it printed, throwing when it fails.
 *
 * A generator script needs the output of a tool — Biome, above all — and any two of them writing
 * the same `spawnSync` invocation is a clone the duplicated-code guard reports for good reason. The
 * command is resolved through the caller's own `PATH` (`npm` and `node_modules/.bin` ahead of it,
 * because the scripts run under `npm run`), and a non-zero status carries the tool's stderr into the
 * error rather than a status number alone.
 *
 * @param command - The executable to run, resolved through `PATH`.
 * @param args - The arguments to pass it.
 * @returns The captured standard output and standard error, decoded as text.
 * @throws When the command exits non-zero or cannot be spawned.
 */
export function runCommand(
  command: string,
  args: readonly string[],
): { stdout: string; stderr: string } {
  const result: SpawnSyncReturns<string> = spawnSync(command, [...args], {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}`);
  }

  return { stdout: result.stdout, stderr: result.stderr };
}
