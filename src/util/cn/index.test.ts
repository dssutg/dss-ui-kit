/**
 * Tests for the class-name merge the components use. A failure here would mean a caller could not
 * override a class the component already set, or that an unrelated class was dropped on the way.
 */

import { describe, expect, test } from 'vitest';
import { cn } from './';

describe('cn', () => {
  test("keeps the caller's class where both set the same property", () => {
    expect(cn('opacity-[0.4]', 'opacity-90')).toBe('opacity-90');
  });

  test('keeps classes that set different properties', () => {
    expect(cn('p-2 text-tpl', 'w-1/2')).toBe('p-2 text-tpl w-1/2');
  });

  test('ignores the values a conditional class name leaves out', () => {
    expect(cn('p-2', undefined, null, false, '')).toBe('p-2');
  });

  test('returns an empty string when there is nothing to join', () => {
    expect(cn()).toBe('');
  });
});
