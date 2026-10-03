/**
 * IPv4 parsing feeds address inputs and octet-wise comparisons, so the suite holds the two halves
 * apart: the regex is the strict validator an edit box is held to, while `parseIp` is the lenient
 * normaliser that turns whatever arrived into comparable octets without ever throwing.
 */
import { describe, expect, test } from 'vitest';
import { ipv4Regex, parseIp } from './';

/**
 * The regex is the gate a value has to pass to be an address at all, so the standard's edges —
 * octet range, no leading zeros, exactly four octets, nothing trailing — are each their own case.
 */
describe('ipv4Regex', () => {
  test('accepts a well-formed address', () => {
    expect(ipv4Regex.test('192.168.0.1')).toBe(true);
  });

  test('accepts the extremes of each octet', () => {
    expect(ipv4Regex.test('0.0.0.0')).toBe(true);
    expect(ipv4Regex.test('255.255.255.255')).toBe(true);
  });

  test('rejects an octet above 255', () => {
    expect(ipv4Regex.test('256.0.0.0')).toBe(false);
  });

  test('rejects an octet with a leading zero', () => {
    expect(ipv4Regex.test('01.2.3.4')).toBe(false);
  });

  test('rejects an address with too few octets', () => {
    expect(ipv4Regex.test('1.2.3')).toBe(false);
  });

  test('rejects an address with too many octets', () => {
    expect(ipv4Regex.test('1.2.3.4.5')).toBe(false);
  });

  test('rejects trailing text', () => {
    expect(ipv4Regex.test('1.2.3.4 and more')).toBe(false);
  });

  test('rejects an empty string', () => {
    expect(ipv4Regex.test('')).toBe(false);
  });
});

/**
 * Parsing is normalisation for comparison, not validation — that is the regex's job — so malformed
 * input reading as zeroes is the contract rather than a bug.
 */
describe('parseIp', () => {
  test('parses four octets as numbers', () => {
    expect(parseIp('192.168.0.1')).toEqual([192, 168, 0, 1]);
  });

  test('pads a short address with zeroes', () => {
    expect(parseIp('10.0.1')).toEqual([10, 0, 1, 0]);
  });

  test('trims a long address to four octets', () => {
    expect(parseIp('1.2.3.4.5')).toEqual([1, 2, 3, 4]);
  });

  test('reads a missing octet as zero rather than NaN', () => {
    expect(parseIp('..')).toEqual([0, 0, 0, 0]);
  });

  test('never throws on malformed input', () => {
    expect(() => parseIp('not an address')).not.toThrow();
    expect(parseIp('not an address')).toEqual([0, 0, 0, 0]);
  });

  test('makes two addresses comparable by their octets', () => {
    expect(parseIp('10.0.0.2')).toEqual(parseIp('10.0.0.02').map((octet) => octet));
    expect(parseIp('10.0.0.2') > parseIp('10.0.0.1')).toBe(true);
  });
});
