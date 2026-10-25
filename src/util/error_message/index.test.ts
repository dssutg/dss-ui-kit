// SPDX-License-Identifier: MIT
/**
 * Tests for reading a thrown value's message. Both arms matter: an `Error` must keep the message it
 * was given, and anything else must render through `String` rather than being read as though it had
 * a `.message` of its own.
 */
import { describe, expect, test } from 'vitest';
import { errorMessage } from './';

describe('errorMessage', () => {
  test('returns the message of an Error', () => {
    expect(errorMessage(new Error('something failed'))).toBe('something failed');
  });

  test('returns a thrown string as it is', () => {
    expect(errorMessage('something failed')).toBe('something failed');
  });

  test('renders a thrown number as text', () => {
    expect(errorMessage(42)).toBe('42');
  });

  test('renders null as text', () => {
    expect(errorMessage(null)).toBe('null');
  });

  test('renders undefined as text', () => {
    expect(errorMessage(undefined)).toBe('undefined');
  });

  test('uses the custom toString of a thrown object', () => {
    expect(errorMessage({ toString: () => 'custom message' })).toBe('custom message');
  });
});
