/**
 * Tests for the exhaustive-switch sentinel and its `ExhaustiveVoid` companion type: together they
 * force every branch of a switch over a union to return or throw. A failure here would mean a
 * switch can claim completeness while silently ignoring a case.
 */

import { describe, expect, test } from 'vitest';
import { ExhaustiveCheckDone, type ExhaustiveVoid } from './';

/**
 * The sentinel a completed exhaustive switch returns to the caller, so a forgotten return fails
 * the type check before it can fail silently at runtime.
 */
describe('ExhaustiveCheckDone', () => {
  test('is the true value a switch statement returns to say every case is handled', () => {
    // The type makes a caller that forgets to return it a compile error.
    const exhaustive: ExhaustiveVoid = ExhaustiveCheckDone;

    expect(exhaustive).toBe(true);
  });
});
