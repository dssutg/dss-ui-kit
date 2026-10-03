/**
 * `unreachable` is the exhaustiveness check a `switch` over a union leans on: it can never be reached
 * in a compile-clean program, so the only behaviour to test is the one runtime case — that it throws,
 * loudly, carrying the value that arrived, instead of silently continuing.
 */
import { describe, expect, test } from 'vitest';
import { unreachable } from './';

describe('unreachable', () => {
  test('always throws, carrying the value that arrived', () => {
    expect(() => unreachable('surprise' as never)).toThrowError(
      'Unreachable value reached: "surprise"',
    );
  });
});
