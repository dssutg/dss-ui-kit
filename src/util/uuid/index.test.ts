/**
 * `uuidv4` is used for keys where uniqueness is the only requirement, so the suite holds it to
 * exactly that: an identifier shaped as RFC 4122 version 4 and one that does not repeat.
 */
import { describe, expect, test } from 'vitest';
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
});
