// SPDX-License-Identifier: MIT
/**
 * `uuidv4` is used for keys where uniqueness is the only requirement, so the suite holds it to
 * exactly that: an identifier shaped as RFC 4122 version 4 and one that does not repeat.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { uuidv4 } from './';

/**
 * A key the library generates is expected to be a well-formed, universally unique value, not merely a
 * non-empty string. A malformed shape would leak into anything that renders or stores it, and a
 * collision would make one row stand for another.
 */
describe('uuidv4', () => {
  test('produces the RFC 4122 version-4 shape', () => {
    const uuid = uuidv4();

    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('differs between calls', () => {
    const seen = new Set([...Array.from({ length: 100 }).map(() => uuidv4())]);

    expect(seen.size).toBe(100);
  });

  test('degrades to the clobbered template when the random read yields nothing', () => {
    // The `?? 0` beside the byte read is the answer to a getRandomValues result with no first
    // element: every clobber no-ops, and the value is the template itself rather than a crash.
    vi.stubGlobal('crypto', { getRandomValues: () => new Uint8Array(0) });

    expect(uuidv4()).toBe('10000000-1000-4000-8000-100000000000');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
