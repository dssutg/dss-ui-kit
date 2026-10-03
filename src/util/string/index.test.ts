import { describe, expect, test } from 'vitest';
import { capitalize, trimEndNewlines } from './';

describe('capitalize', () => {
  test('uppercases the first character', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  test('leaves the rest of the string alone', () => {
    expect(capitalize('hello WORLD')).toBe('Hello WORLD');
  });

  test('returns an empty string unchanged', () => {
    expect(capitalize('')).toBe('');
  });

  test('defaults to an empty string', () => {
    expect(capitalize()).toBe('');
  });

  test('uppercases a single character', () => {
    expect(capitalize('a')).toBe('A');
  });
});

describe('trimEndNewlines', () => {
  test('removes trailing newlines', () => {
    expect(trimEndNewlines('text\n')).toBe('text');
  });

  test('removes trailing carriage returns', () => {
    expect(trimEndNewlines('text\r')).toBe('text');
  });

  test('removes a mixed run of newlines and carriage returns', () => {
    expect(trimEndNewlines('text\r\n\r\n')).toBe('text');
  });

  test('leaves interior line breaks alone', () => {
    expect(trimEndNewlines('line1\nline2')).toBe('line1\nline2');
  });

  test('removes every trailing newline', () => {
    expect(trimEndNewlines('text\n\n\n')).toBe('text');
  });

  test('returns the original string when there is nothing to trim', () => {
    const text = 'text';

    expect(trimEndNewlines(text)).toBe(text);
  });

  test('trims a string that is only newlines to empty', () => {
    expect(trimEndNewlines('\n\r\n')).toBe('');
  });
});
