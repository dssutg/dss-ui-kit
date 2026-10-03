import { describe, expect, test } from 'vitest';
import { unreachable } from './';

describe('unreachable', () => {
  test('always throws, carrying the value that arrived', () => {
    expect(() => unreachable('surprise' as never)).toThrowError(
      'Unreachable value reached: "surprise"',
    );
  });
});
