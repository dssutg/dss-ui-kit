/**
 * Orders dotted version numbers, so a caller can ask which of two it has without writing the loop.
 *
 * The comparison is numeric per part rather than lexicographic, which is the whole point: as strings
 * `'1.10' < '1.9'` is true, and as versions it is not. A version that runs out of parts is padded with
 * zeroes, so `'1.2'` and `'1.2.0'` are the same version — the trailing zeroes are how one is written,
 * not something it has.
 *
 * A part that is not a number counts as `0`, which is the reading that keeps a version with something
 * unexpected in it (`'1.2.beta'`) comparable instead of throwing at the sort. It does not mean the
 * version is a well-formed one: this compares what the parts are worth, and the library says nothing
 * about what a caller's version strings may contain.
 *
 * The result is `-1`, `0` or `1`, so it can be handed straight to `Array.prototype.sort`.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const aParts = a.split('.');
  const bParts = b.split('.');

  for (let index = 0; index < Math.max(aParts.length, bParts.length); index++) {
    const difference = versionPart(aParts[index]) - versionPart(bParts[index]);

    if (difference !== 0) {
      return difference < 0 ? -1 : 1;
    }
  }

  return 0;
}

/** One part of a dotted version as a number, where a part that is missing or not a number is `0`. */
function versionPart(part: string | undefined): number {
  const value = Number(part ?? 0);

  return Number.isNaN(value) ? 0 : value;
}
