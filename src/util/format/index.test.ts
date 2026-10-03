/**
 * The hex formatters render register values and identifiers the way a manual writes them: upper
 * case, grouped in byte pairs and zero-padded to a width, so columns of them line up. Padding must
 * widen rather than truncate when a value outgrows the requested width — a register shown short of
 * its high bytes is wrong at a glance.
 */
import { describe, expect, test } from 'vitest';
import { formatHexNumber, formatNumberAsHexBytes } from './';

describe('formatNumberAsHexBytes', () => {
  test('formats a value as upper-case hex bytes grouped in pairs', () => {
    expect(formatNumberAsHexBytes(0x1234)).toBe('12 34');
  });

  test('pads to the requested byte width', () => {
    expect(formatNumberAsHexBytes(0x34, 2)).toBe('00 34');
  });

  test('widens on its own when the value does not fit the requested width', () => {
    expect(formatNumberAsHexBytes(0x123456, 1)).toBe('12 34 56');
  });

  test('formats zero as a single byte', () => {
    expect(formatNumberAsHexBytes(0)).toBe('00');
  });

  test('formats zero padded to two bytes', () => {
    expect(formatNumberAsHexBytes(0, 2)).toBe('00 00');
  });

  test('pads an odd-width value with a leading zero', () => {
    expect(formatNumberAsHexBytes(0xabc)).toBe('0A BC');
  });
});

describe('formatHexNumber', () => {
  test('formats upper-case hex zero-padded to the requested digits', () => {
    expect(formatHexNumber(0x1a, 4)).toBe('00 1A');
  });

  test('groups digits in pairs separated by spaces', () => {
    expect(formatHexNumber(0xaabbccdd, 8)).toBe('AA BB CC DD');
  });

  test('pads zero to the requested digits', () => {
    expect(formatHexNumber(0, 2)).toBe('00');
  });
});
