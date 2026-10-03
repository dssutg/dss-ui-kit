/**
 * Tests for the try/catch wrappers that turn a throwing getter or a rejected promise into a
 * `[value, error]` result. A failure here would mean an exception escapes code that was told it
 * is captured, or a thrown error is reported as a success.
 */

import { describe, expect, test } from 'vitest';
import { tryCatch, tryCatchAsync } from './';

/**
 * The synchronous wrapper: a thrown error becomes the `[null, error]` half of the result instead
 * of propagating.
 */
describe('tryCatch', () => {
  test('returns the value and a null error when the getter succeeds', () => {
    const [value, error] = tryCatch(() => 42);

    expect(value).toBe(42);
    expect(error).toBeNull();
  });

  test('returns a null value and the error when the getter throws', () => {
    const failure = new Error('failed');
    const [value, error] = tryCatch(() => {
      throw failure;
    });

    expect(value).toBeNull();
    expect(error).toBe(failure);
  });

  test('does not rethrow', () => {
    expect(() =>
      tryCatch(() => {
        throw new Error('boom');
      }),
    ).not.toThrow();
  });
});

/**
 * The promise wrapper: a rejection becomes the `[null, error]` half of the result instead of
 * propagating.
 */
describe('tryCatchAsync', () => {
  test('returns the resolved value and a null error', async () => {
    const [value, error] = await tryCatchAsync(async () => 'ok');

    expect(value).toBe('ok');
    expect(error).toBeNull();
  });

  test('returns a null value and the error from a rejected promise', async () => {
    const failure = new Error('rejected');
    const [value, error] = await tryCatchAsync(() => Promise.reject(failure));

    expect(value).toBeNull();
    expect(error).toBe(failure);
  });
});
