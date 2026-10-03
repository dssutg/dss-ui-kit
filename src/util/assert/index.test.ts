import { describe, expect, test } from 'vitest';
import { ExhaustiveCheckDone, type ExhaustiveVoid } from './';

describe('ExhaustiveCheckDone', () => {
  test('is the true value a switch statement returns to say every case is handled', () => {
    // The type makes a caller that forgets to return it a compile error.
    const exhaustive: ExhaustiveVoid = ExhaustiveCheckDone;

    expect(exhaustive).toBe(true);
  });
});
