import { describe, expect, it } from 'vitest';
import { compareSemVer, formatSemVer, incrementVersion, parseSemVer } from './semver';

/** Parses a version, failing the test rather than returning null when the input is invalid. */
function parsed(value: string) {
  const version = parseSemVer(value);
  if (!version) {
    throw new Error(`Expected '${value}' to parse as semver`);
  }
  return version;
}

describe('parseSemVer', () => {
  it('splits a release into its parts', () => {
    expect(parsed('1.4.2')).toMatchObject({
      major: 1,
      minor: 4,
      patch: 2,
      prerelease: [],
      build: [],
    });
  });

  it('keeps prerelease and build metadata', () => {
    expect(parsed('2.0.0-rc.1+build.7')).toMatchObject({
      prerelease: ['rc', '1'],
      build: ['build', '7'],
    });
  });

  it('rejects input that is not semver', () => {
    for (const value of ['', '1', '1.2', '01.2.3', 'v1.2.3', '1.2.3-']) {
      expect(parseSemVer(value)).toBeNull();
    }
  });
});

describe('formatSemVer', () => {
  it('round-trips a release', () => {
    expect(formatSemVer(parsed('1.4.2'))).toBe('1.4.2');
  });

  it('round-trips a prerelease with build metadata', () => {
    expect(formatSemVer(parsed('2.0.0-rc.1+build.7'))).toBe('2.0.0-rc.1+build.7');
  });
});

describe('compareSemVer', () => {
  /** Signs the comparison of two versions: negative when `a` precedes `b`. */
  function order(a: string, b: string): number {
    return Math.sign(compareSemVer(parsed(a), parsed(b)));
  }

  it('orders by major, then minor, then patch', () => {
    expect(order('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(order('1.9.0', '1.8.9')).toBeGreaterThan(0);
    expect(order('1.8.9', '1.8.10')).toBeLessThan(0);
    expect(order('1.2.3', '1.2.3')).toBe(0);
  });

  it('ranks a prerelease below the release it precedes', () => {
    expect(order('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
    expect(order('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
  });

  it('compares numeric prerelease identifiers numerically, not as text', () => {
    // As numbers 10 follows 9, so rc.10 is the newer release. As text '10' precedes '9', which
    // would put them in the wrong order.
    expect(order('1.0.0-rc.10', '1.0.0-rc.9')).toBeGreaterThan(0);
  });

  it('ranks numeric identifiers below alphanumeric ones', () => {
    expect(order('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0);
  });

  it('ranks a longer prerelease above a shorter one sharing its prefix', () => {
    expect(order('1.0.0-rc', '1.0.0-rc.1')).toBeLessThan(0);
  });

  it('compares alphanumeric identifiers as text', () => {
    expect(order('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
  });

  it('ignores build metadata, as the specification requires', () => {
    expect(order('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
    expect(order('1.0.0+a', '1.0.0+b')).toBe(0);
  });

  it('sorts a mixed list from oldest to newest', () => {
    const ascending = ['1.0.0-rc.2', '1.0.0-rc.10', '1.0.0-rc.1', '0.9.9', '1.0.0'].map((value) =>
      parsed(value),
    );

    expect(ascending.sort(compareSemVer).map(formatSemVer)).toEqual([
      '0.9.9',
      '1.0.0-rc.1',
      '1.0.0-rc.2',
      '1.0.0-rc.10',
      '1.0.0',
    ]);
  });
});

describe('incrementVersion', () => {
  it('increments the part named by the release type', () => {
    expect(formatSemVer(incrementVersion(parsed('1.4.2'), 'major'))).toBe('2.0.0');
    expect(formatSemVer(incrementVersion(parsed('1.4.2'), 'minor'))).toBe('1.5.0');
    expect(formatSemVer(incrementVersion(parsed('1.4.2'), 'patch'))).toBe('1.4.3');
  });

  it('leaves the version alone for a release that is not triggered', () => {
    expect(formatSemVer(incrementVersion(parsed('1.4.2'), 'none'))).toBe('1.4.2');
  });

  it('clears prerelease and build metadata', () => {
    expect(formatSemVer(incrementVersion(parsed('2.0.0-rc.1+build.7'), 'major'))).toBe('3.0.0');
  });
});
