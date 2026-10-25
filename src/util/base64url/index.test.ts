// SPDX-License-Identifier: MIT
/**
 * Tests for unpadded base64url.
 *
 * The round-trips exercise every byte position in a three-byte group, the known vectors pin the
 * alphabet to RFC 4648 §5, and the rejection cases hold each decoding path to the character it
 * reports.
 */
import { describe, expect, test } from 'vitest';
import { fromBase64Url, toBase64Url } from './';

const knownVectors: [string, number[]][] = [
  ['', []],
  ['Zg', [0x66]],
  ['Zm8', [0x66, 0x6f]],
  ['Zm9v', [0x66, 0x6f, 0x6f]],
  ['Zm9vYg', [0x66, 0x6f, 0x6f, 0x62]],
  ['Zm9vYmE', [0x66, 0x6f, 0x6f, 0x62, 0x61]],
  ['Zm9vYmFy', [0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]],
  ['-w', [0xfb]],
  ['-_8', [0xfb, 0xff]],
];

function bytesOfLength(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, index) => (index * 53 + 7) % 256));
}

describe('round trip', () => {
  for (let length = 0; length <= 6; length++) {
    test(`keeps a ${length}-byte array`, () => {
      const bytes = bytesOfLength(length);

      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    });
  }

  test('keeps a longer array', () => {
    const bytes = bytesOfLength(257);

    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  test('keeps the whole alphabet', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    expect(toBase64Url(fromBase64Url(text))).toBe(text);
  });
});

describe('encoding', () => {
  test.each(knownVectors)('encodes the known vector %s', (encoded, bytes) => {
    expect(toBase64Url(new Uint8Array(bytes))).toBe(encoded);
  });

  test('emits neither padding nor the standard base64 characters', () => {
    const encoded = toBase64Url(bytesOfLength(256));

    expect(encoded).not.toMatch(/[+/=]/);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('decoding', () => {
  test.each(knownVectors)('decodes the known vector %s', (encoded, bytes) => {
    expect(fromBase64Url(encoded)).toEqual(new Uint8Array(bytes));
  });

  test('decodes an empty string to no bytes', () => {
    expect(fromBase64Url('')).toEqual(new Uint8Array(0));
  });

  test.each([
    ['+AAA', '+'],
    ['A+AA', '+'],
    ['AA+A', '+'],
    ['AAA+', '+'],
    ['AAA=', '='],
  ])('rejects %s naming %s', (input, character) => {
    expect(() => fromBase64Url(input)).toThrowError(`Invalid base64url character: ${character}`);
  });

  test('rejects a length no encoding can produce', () => {
    expect(() => fromBase64Url('A')).toThrowError('Invalid base64url length: 1');
    expect(() => fromBase64Url('AAAAA')).toThrowError('Invalid base64url length: 5');
  });
});
