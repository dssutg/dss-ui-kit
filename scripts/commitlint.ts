#!/usr/bin/env -S deno run --allow-read
import { validateCommitMessage } from './util/conventional.ts';

function readStdin(): string {
  const buffer = new Uint8Array(65536);
  const read = Deno.stdin.readSync(buffer);
  return new TextDecoder().decode(buffer.subarray(0, read ?? 0));
}

function main(message: string): void {
  const problems = validateCommitMessage(message);
  if (problems.length === 0) {
    return;
  }

  const subject = message.split('\n')[0] ?? '';
  console.error('✖ Invalid commit message:');
  console.error(`  ${subject}`);
  console.error('');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error('');
  console.error('Conventional Commits format:');
  console.error('  <type>(<scope>)!: <description>');
  console.error('');
  console.error('Example:');
  console.error('  feat(ui): add a tooltip to the button');
  console.error('  fix(import): keep the @ alias working when a file moves');
  console.error('  feat(locale)!: drop the message keys the package no longer renders');

  Deno.exit(1);
}

/**
 * Validates a commit message against the Conventional Commits rules of this repository.
 *
 * Reads the message from stdin by default, or from `--message <text>`. Exits non-zero and prints
 * every rule that was violated when the message is invalid.
 */
if (import.meta.main) {
  const args = Deno.args;
  const message = args[0] === '--message' ? (args[1] ?? '') : readStdin();
  main(message.replace(/\n+$/, ''));
}
