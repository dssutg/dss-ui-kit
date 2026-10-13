/**
 * Whether the application's tab is on screen, cached in module state by a listener installed at
 * import. The value is read off `document.hidden` the moment `visibilitychange` fires, so the test
 * defines that property directly — it is what the source reads — dispatches the event and reads
 * `isAppTabActive` on the next read.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { isAppTabActive } from './';

afterEach(() => {
  // Each own property defined in the tests goes away with it, and the prototype getter
  // jsdom provides takes over again.
  delete (document as unknown as { hidden?: boolean }).hidden;
});

describe('isAppTabActive', () => {
  test('starts true, before any visibility report arrived', () => {
    expect(isAppTabActive()).toBe(true);
  });

  test('reports a tab that went to the background, and recovers when it is shown again', () => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(isAppTabActive()).toBe(false);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(isAppTabActive()).toBe(true);
  });
});
