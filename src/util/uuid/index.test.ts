import { describe, expect, test } from 'vitest';
import { uuidv4 } from './';

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
