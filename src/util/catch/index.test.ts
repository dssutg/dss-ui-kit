import { describe, expect, test } from 'vitest';
import { tryCatch, tryCatchAsync } from './';

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
