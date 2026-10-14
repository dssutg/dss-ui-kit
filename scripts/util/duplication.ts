// SPDX-License-Identifier: MIT
// The clone detector the duplicated-code guard runs, over token windows of the source.
// The clone detector the duplicated-code guard runs, over token windows of the source.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { collectFiles, REPOSITORY_ROOT } from './source-tree.ts';

/**
 * Finds blocks of source that are written more than once.
 *
 * This is the detector behind `scripts/duplicated-code.test.ts`. Duplicated logic is the defect
 * AGENTS.md calls out by name — a fact that lives in two copies is a fact the next change has to
 * make twice, and the second copy is the one that gets missed. A review catches the copy someone
 * was looking at; it does not catch the one across the tree, which is why the search is mechanical.
 *
 * The algorithm is the usual token-window one, kept small on purpose:
 *
 * 1. Each file is tokenized with the TypeScript scanner, so comments, whitespace and formatting
 *    disappear before anything is compared. A clone that has merely been reformatted or commented
 *    differently is still a clone; line numbers are recovered afterwards for the report.
 * 2. Every window of `minTokens` consecutive tokens is rolled into a 53-bit hash — two independent
 *    32-bit polynomial hashes combined — and windows that share a hash are grouped.
 * 3. Within a group, each pair of windows is verified token by token, extended as far as the two
 *    runs stay equal, and recorded only when it cannot be extended to the left. That last rule is
 *    what keeps a 100-token clone from being reported once for every one of its overlapping windows.
 *
 * The result is data about the code, not a judgement about it: which block, how long, and where the
 * copies sit. What to do about a clone is a decision for whoever reads the report.
 */

/** A file to scan: its repository-relative path and its text. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** One copy of a duplicated block, with one-based, inclusive line numbers. */
export interface CloneLocation {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
}

/** A block of code that appears in two or more places. */
export interface DuplicateBlock {
  /** How many tokens long the block is. */
  readonly tokenCount: number;
  /** Every place the block appears, ordered by path and then by line. */
  readonly locations: readonly CloneLocation[];
  /** A stable identity for the block's content and the files it sits in, over a difference in line numbers. */
  readonly signature: string;
}

/**
 * The shortest run of tokens that counts as a duplicated block.
 *
 * Below this, the match is noise: two `if (x === undefined) return null;` lines are the same shape
 * without being the same logic. The value is a starting point rather than a constant of nature, and
 * a change to it means the baseline has to be regenerated, so it is named here once.
 */
export const DEFAULT_MIN_TOKENS = 50;

/**
 * Files whose content is data rather than logic, each excluded for a stated reason.
 *
 * `src/icons/index.tsx` is generated from the source SVGs and holds only path data; two icons that
 * share a curve are not duplicated logic, and the file is regenerated wholesale anyway.
 */
const EXCLUDED_PATHS = new Set(['src/icons/index.tsx']);

/** Extensions the detector reads. It compares TypeScript, not markup, CSS or data catalogues. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** The two polynomial bases the window hash is rolled with, independent so a collision needs both. */
const HASH_BASES: readonly [number, number] = [0x01000193, 0x85ebca6b];

/** 2^21, the width the second 32-bit hash is folded into the first. */
const WINDOW_HASH_SHIFT = 0x200000;

/** The separator between tokens in a block's content, so two token splits cannot look alike. */
const TOKEN_SEPARATOR = '\u0000';

interface Tokens {
  readonly values: string[];
  readonly lines: Uint32Array;
}

interface SourceTokens {
  readonly path: string;
  readonly values: string[];
  readonly lines: Uint32Array;
}

interface WindowIndex {
  readonly keys: Float64Array;
  readonly fileOf: Uint32Array;
  readonly startOf: Uint32Array;
}

/** Type-of-record used while matching: content key to the locations it was found at. */
type LocationAccumulator = Map<string, Map<string, CloneLocation>>;

/** Every source file the detector reads, with its text. */
export function collectSourceFiles(): SourceFile[] {
  return collectFiles()
    .filter(isSourceFile)
    .map((path) => ({ path, text: readFileSync(join(REPOSITORY_ROOT, path), 'utf8') }));
}

/** The duplicated blocks in the given files, longest-first within each location. */
export function findDuplicateBlocks(
  files: readonly SourceFile[],
  minTokens: number = DEFAULT_MIN_TOKENS,
): DuplicateBlock[] {
  const sources = files.map(toSourceTokens);

  return detect(sources, minTokens);
}

/** Whether a repository-relative path is source the detector should compare. */
function isSourceFile(path: string): boolean {
  if (EXCLUDED_PATHS.has(path)) {
    return false;
  }
  if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) {
    return false;
  }

  return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension));
}

/** Scans a source file into the token stream the comparison runs on. */
function tokenize(text: string): Tokens {
  const starts = lineStarts(text);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ true,
    ts.LanguageVariant.Standard,
    text,
  );
  const values: string[] = [];
  const lines: number[] = [];
  let line = 0;

  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    const position = scanner.getTokenStart();
    let next = starts[line + 1];

    while (next !== undefined && next <= position) {
      line++;
      next = starts[line + 1];
    }

    values.push(scanner.getTokenText());
    lines.push(line);
  }

  return { values, lines: Uint32Array.from(lines) };
}

/** The offset of the first character of every line, so a token position maps back to a line. */
function lineStarts(text: string): number[] {
  const starts = [0];
  let position = text.indexOf('\n');

  while (position !== -1) {
    starts.push(position + 1);
    position = text.indexOf('\n', position + 1);
  }

  return starts;
}

/** Reads a file's text into the token stream and the file's identity together. */
function toSourceTokens(file: SourceFile): SourceTokens {
  const { values, lines } = tokenize(file.text);

  return { path: file.path, values, lines };
}

/** Indexes every token window across the files and reports the blocks that appear more than once. */
function detect(sources: readonly SourceTokens[], window: number): DuplicateBlock[] {
  const windows = buildWindows(sources, window);
  const buckets = groupKeys(windows.keys);
  const accumulator: LocationAccumulator = new Map();
  const lengths = new Map<string, number>();

  for (const indices of buckets.values()) {
    matchBucket(indices, windows, sources, window, accumulator, lengths);
  }

  return toBlocks(accumulator, lengths);
}

/** Hashes every window of the given length across every file, keeping where each window came from. */
function buildWindows(sources: readonly SourceTokens[], window: number): WindowIndex {
  let total = 0;

  for (const source of sources) {
    total += Math.max(0, source.values.length - window + 1);
  }

  const keys = new Float64Array(total);
  const fileOf = new Uint32Array(total);
  const startOf = new Uint32Array(total);
  const [baseA, baseB] = HASH_BASES;
  let cursor = 0;

  for (const [file, source] of sources.entries()) {
    if (source.values.length < window) {
      continue;
    }

    const hashes = tokenHashes(source.values);
    const first = rollingHash(hashes, window, baseA);
    const second = rollingHash(hashes, window, baseB);

    for (const [start, value] of first.entries()) {
      keys[cursor] = value * WINDOW_HASH_SHIFT + (second[start]! & (WINDOW_HASH_SHIFT - 1));
      fileOf[cursor] = file;
      startOf[cursor] = start;
      cursor++;
    }
  }

  return { keys, fileOf, startOf };
}

/** A stable 32-bit hash per token, so the rolling window hash has numbers to fold. */
function tokenHashes(values: readonly string[]): Uint32Array {
  const hashes = new Uint32Array(values.length);

  for (const [index, value] of values.entries()) {
    hashes[index] = fnv1a(value);
  }

  return hashes;
}

/** The FNV-1a hash of a token, over its own text. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * The polynomial window hash at every start, rolled forward from the previous window.
 *
 * The forward recurrence removes the token leaving the window and adds the one entering it, so the
 * whole file costs one multiply per token rather than a re-hash of `window` tokens per position.
 */
function rollingHash(hashes: Uint32Array, window: number, base: number): Uint32Array {
  const count = Math.max(0, hashes.length - window + 1);
  const out = new Uint32Array(count);

  if (count === 0) {
    return out;
  }

  const highPower = power(base, window - 1);
  let hash = 0;

  for (let index = 0; index < window; index++) {
    hash = (Math.imul(hash, base) + hashes[index]!) >>> 0;
  }

  out[0] = hash;

  for (let index = 1; index < count; index++) {
    const removed = Math.imul(hashes[index - 1]!, highPower) >>> 0;
    hash = (Math.imul((hash - removed) >>> 0, base) + hashes[index + window - 1]!) >>> 0;
    out[index] = hash;
  }

  return out;
}

/** `base` raised to `exponent` modulo 2^32. */
function power(base: number, exponent: number): number {
  let result = 1;

  for (let index = 0; index < exponent; index++) {
    result = Math.imul(result, base) >>> 0;
  }

  return result;
}

/** Keeps only the window hashes that occur more than once, grouped by the hash they share. */
function groupKeys(keys: Float64Array): Map<number, number[]> {
  const counts = new Map<number, number>();

  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const buckets = new Map<number, number[]>();

  for (const [index, key] of keys.entries()) {
    if ((counts.get(key) ?? 0) < 2) {
      continue;
    }

    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [index]);
    } else {
      bucket.push(index);
    }
  }

  return buckets;
}

/** Compares every pair of windows that share a hash, recording the maximal matches among them. */
function matchBucket(
  indices: readonly number[],
  windows: WindowIndex,
  sources: readonly SourceTokens[],
  window: number,
  accumulator: LocationAccumulator,
  lengths: Map<string, number>,
): void {
  for (let a = 0; a < indices.length; a++) {
    for (let b = a + 1; b < indices.length; b++) {
      recordMatch(indices[a]!, indices[b]!, windows, sources, window, accumulator, lengths);
    }
  }
}

/** Verifies one candidate pair and, if it is a maximal match, records both of its locations. */
function recordMatch(
  first: number,
  second: number,
  windows: WindowIndex,
  sources: readonly SourceTokens[],
  window: number,
  accumulator: LocationAccumulator,
  lengths: Map<string, number>,
): void {
  const fileA = windows.fileOf[first]!;
  const startA = windows.startOf[first]!;
  const fileB = windows.fileOf[second]!;
  const startB = windows.startOf[second]!;

  if (fileA === fileB && Math.abs(startA - startB) < window) {
    return;
  }

  const sourceA = sources[fileA]!;
  const sourceB = sources[fileB]!;

  if (!sameWindow(sourceA.values, startA, sourceB.values, startB, window)) {
    return;
  }
  if (isExtendableLeft(sourceA.values, startA, sourceB.values, startB)) {
    return;
  }

  const length = extendRight(sourceA.values, startA, sourceB.values, startB, window);
  const content = sourceA.values.slice(startA, startA + length).join(TOKEN_SEPARATOR);

  addLocation(accumulator, content, sourceA, startA, length);
  addLocation(accumulator, content, sourceB, startB, length);
  lengths.set(content, length);
}

/** Whether the two runs are equal token for token across the whole window. */
function sameWindow(
  a: readonly string[],
  startA: number,
  b: readonly string[],
  startB: number,
  window: number,
): boolean {
  for (let offset = 0; offset < window; offset++) {
    if (a[startA + offset] !== b[startB + offset]) {
      return false;
    }
  }

  return true;
}

/** Whether the match starts one token later, which means this is not its leftmost window. */
function isExtendableLeft(
  a: readonly string[],
  startA: number,
  b: readonly string[],
  startB: number,
): boolean {
  if (startA === 0 || startB === 0) {
    return false;
  }

  return a[startA - 1] === b[startB - 1];
}

/** How far the two runs stay equal, starting from a window that is already known to match. */
function extendRight(
  a: readonly string[],
  startA: number,
  b: readonly string[],
  startB: number,
  window: number,
): number {
  let length = window;

  while (
    startA + length < a.length &&
    startB + length < b.length &&
    a[startA + length] === b[startB + length]
  ) {
    length++;
  }

  return length;
}

/** Adds a location to a block's accumulator entry, keyed so the same copy is not added twice. */
function addLocation(
  accumulator: LocationAccumulator,
  content: string,
  source: SourceTokens,
  start: number,
  length: number,
): void {
  const location: CloneLocation = {
    path: source.path,
    startLine: source.lines[start]! + 1,
    endLine: source.lines[start + length - 1]! + 1,
  };
  const key = `${location.path}:${location.startLine}`;
  const locations = accumulator.get(content);

  if (locations === undefined) {
    accumulator.set(content, new Map([[key, location]]));
  } else {
    locations.set(key, location);
  }
}

/** Turns the accumulator into sorted blocks, dropping anything found in only one place. */
function toBlocks(
  accumulator: LocationAccumulator,
  lengths: Map<string, number>,
): DuplicateBlock[] {
  const blocks: DuplicateBlock[] = [];

  for (const [content, locations] of accumulator) {
    if (locations.size < 2) {
      continue;
    }

    const sorted = [...locations.values()].sort(compareLocations);
    blocks.push({
      tokenCount: lengths.get(content) ?? 0,
      locations: sorted,
      signature: signatureOf(sorted, content),
    });
  }

  return blocks.sort(compareBlocks);
}

/**
 * The identity a block is accepted under in the baseline.
 *
 * It is the content and the sorted set of files, and deliberately not the line numbers: moving a
 * function down a file does not make its clone a new one, while changing the code, or which files
 * share it, does. A baseline keyed by line would fail on every unrelated edit above the clone.
 */
function signatureOf(locations: readonly CloneLocation[], content: string): string {
  const paths = [...new Set(locations.map((location) => location.path))].sort();

  return createHash('sha256')
    .update(paths.join('\n'))
    .update(TOKEN_SEPARATOR)
    .update(content)
    .digest('hex');
}

function compareLocations(first: CloneLocation, second: CloneLocation): number {
  if (first.path !== second.path) {
    return first.path < second.path ? -1 : 1;
  }

  return first.startLine - second.startLine;
}

function compareBlocks(first: DuplicateBlock, second: DuplicateBlock): number {
  return (
    compareLocations(first.locations[0]!, second.locations[0]!) ||
    first.tokenCount - second.tokenCount ||
    first.signature.localeCompare(second.signature)
  );
}
