/**
 * A semantic version, split into its comparable parts.
 *
 * Build metadata is kept but ignored when comparing, as the specification requires.
 */
export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly (string | number)[];
  readonly build: readonly string[];
}

const SEMVER_PATTERN =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z.-]+))?(?:\+(?<build>[0-9A-Za-z.-]+))?$/;

/** How much a release increments the version. */
export type ReleaseType = 'major' | 'minor' | 'patch' | 'prerelease' | 'none';

/**
 * Parses a semantic version.
 *
 * @param value - The string to parse, for example `1.4.2` or `2.0.0-rc.1`.
 * @returns The parsed version, or `null` when the string is not valid semver.
 */
export function parseSemVer(value: string): SemVer | null {
  const match = SEMVER_PATTERN.exec(value.trim());
  if (!match?.groups) {
    return null;
  }

  const { major, minor, patch, prerelease, build } = match.groups as {
    major: string;
    minor: string;
    patch: string;
    prerelease?: string;
    build?: string;
  };

  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ? prerelease.split('.') : [],
    build: build ? build.split('.') : [],
  };
}

/**
 * Renders a semantic version back to its string form.
 *
 * @param version - The version to render.
 * @returns The version string.
 */
export function formatSemVer(version: SemVer): string {
  const core = `${version.major}.${version.minor}.${version.patch}`;
  const prerelease = version.prerelease.length > 0 ? `-${version.prerelease.join('.')}` : '';
  const build = version.build.length > 0 ? `+${version.build.join('.')}` : '';
  return `${core}${prerelease}${build}`;
}

/**
 * Reports whether a string is a valid semantic version.
 *
 * @param value - The string to check.
 * @returns `true` when {@link parseSemVer} can read the value.
 */
export function isValidSemVer(value: string): boolean {
  return parseSemVer(value) !== null;
}

/**
 * Increments a version by a release type.
 *
 * @param version - The current version.
 * @param releaseType - How far to increment. `none` returns the version unchanged.
 * @returns The incremented version, with any prerelease and build metadata cleared.
 */
export function incrementVersion(version: SemVer, releaseType: ReleaseType): SemVer {
  switch (releaseType) {
    case 'major':
      return { major: version.major + 1, minor: 0, patch: 0, prerelease: [], build: [] };
    case 'minor':
      return {
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
        prerelease: [],
        build: [],
      };
    case 'patch':
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
        prerelease: [],
        build: [],
      };
    case 'prerelease':
      return {
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        prerelease: ['rc', '0'],
        build: [],
      };
    case 'none':
      return version;
  }
}

/** A prerelease identifier made only of digits is compared as a number, not as text. */
const NUMERIC_IDENTIFIER = /^\d+$/;

/**
 * Compares the `major.minor.patch` core of two versions.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns A negative number when `a` precedes `b`, positive when it follows, and `0` when equal.
 */
function compareCore(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Compares a single pair of prerelease identifiers, as described in step 11.4 of the SemVer
 * specification: numeric identifiers compare numerically, and always rank below alphanumeric ones.
 *
 * @param left - Identifier of the left operand.
 * @param right - Identifier of the right operand.
 * @returns A negative number when `left` precedes `right`, positive when it follows, and `0` when
 * they are equal.
 */
function compareIdentifier(left: string, right: string): number {
  if (left === right) return 0;

  const leftIsNumber = NUMERIC_IDENTIFIER.test(left);
  const rightIsNumber = NUMERIC_IDENTIFIER.test(right);
  if (leftIsNumber && rightIsNumber) return Number(left) - Number(right);
  if (leftIsNumber) return -1;
  if (rightIsNumber) return 1;
  return left.localeCompare(right);
}

/**
 * Compares two prerelease lists, as described in step 11 of the SemVer specification.
 *
 * @param a - Prerelease of the left operand.
 * @param b - Prerelease of the right operand.
 * @returns A negative number when `a` precedes `b`, positive when it follows, and `0` when equal.
 */
function comparePrerelease(
  a: readonly (string | number)[],
  b: readonly (string | number)[],
): number {
  // A version carrying no prerelease outranks one that does.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const shared = Math.max(a.length, b.length);
  for (let index = 0; index < shared; index += 1) {
    const left = a[index];
    const right = b[index];
    // A prerelease list ranks below a longer one that shares its prefix.
    if (left === undefined) return -1;
    if (right === undefined) return 1;

    const order = compareIdentifier(String(left), String(right));
    if (order !== 0) return order;
  }

  return 0;
}

/**
 * Orders two semantic versions, newest first when passed to `Array.prototype.sort` with a
 * descending comparator.
 *
 * Build metadata is ignored, and a prerelease sorts below the release it precedes.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns A negative number when `a` precedes `b`, positive when it follows, and `0` when equal.
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  const core = compareCore(a, b);
  if (core !== 0) return core;
  return comparePrerelease(a.prerelease, b.prerelease);
}
