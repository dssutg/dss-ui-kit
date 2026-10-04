/**
 * Tests for the version comparison. A failure here would mean a caller decides it is running a newer
 * build than it actually is, which is the one thing this helper exists to prevent.
 */

import { describe, expect, test } from 'vitest';
import { compareVersions } from './';

describe('compareVersions', () => {
  test('reports a lower version first', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
  });

  test('compares each part as a number, not as text', () => {
    // As strings '1.10' is below '1.9', which is the mistake this comparison exists to avoid.
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
  });

  test('reads a version that ran out of parts as padded with zeroes', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });

  test('reads a part that is not a number as zero, so a version is still comparable', () => {
    expect(compareVersions('1.2.beta', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.beta', '1.2.1')).toBe(-1);
  });

  test('orders a list from oldest to newest', () => {
    const versions = ['1.10.0', '1.9.9', '1.2', '1.2.0'];

    expect([...versions].sort(compareVersions)).toEqual(['1.2', '1.2.0', '1.9.9', '1.10.0']);
  });

  test('treats two empty versions as the same version', () => {
    expect(compareVersions('', '')).toBe(0);
  });
});
