/**
 * The pluralization rules decide how many forms a count selects between, per locale. A wrong index
 * renders a count against the wrong form — "one files", in effect — which an operator reads as
 * broken text. The suite pins the two shipped locales' rules and the fallback a consumer's language
 * would arrive through.
 */
import { describe, expect, test } from 'vitest';
import { getPluralizationIndex, registerPluralRule } from './';

describe('getPluralizationIndex', () => {
  test('English: two forms, one for exactly one', () => {
    expect(getPluralizationIndex('en', 0)).toBe(1);
    expect(getPluralizationIndex('en', 1)).toBe(0);
    expect(getPluralizationIndex('en', 2)).toBe(1);
  });

  test('Russian: three forms, split by the last digit and the teens', () => {
    expect(getPluralizationIndex('ru', 1)).toBe(0);
    expect(getPluralizationIndex('ru', 21)).toBe(0);
    expect(getPluralizationIndex('ru', 2)).toBe(1);
    expect(getPluralizationIndex('ru', 4)).toBe(1);
    expect(getPluralizationIndex('ru', 22)).toBe(1);
    expect(getPluralizationIndex('ru', 11)).toBe(2);
    expect(getPluralizationIndex('ru', 12)).toBe(2);
    expect(getPluralizationIndex('ru', 0)).toBe(2);
    expect(getPluralizationIndex('ru', 5)).toBe(2);
  });

  test('resolves a full locale tag against its primary subtag', () => {
    expect(getPluralizationIndex('en-US', 1)).toBe(0);
    expect(getPluralizationIndex('ru-RU', 2)).toBe(1);
  });

  test('falls back to the English rule for a locale with no registered rules', () => {
    expect(getPluralizationIndex('de', 1)).toBe(0);
    expect(getPluralizationIndex('de', 2)).toBe(1);
  });
});

/**
 * Registration is how a consumer's language pluralizes correctly: the rule is stored under the
 * primary subtag so a regional tag resolves to it rather than falling back to English.
 */
describe('registerPluralRule', () => {
  test('registers the rule a new locale pluralizes by', () => {
    registerPluralRule('xx-test-plural', (count) => (count > 10 ? 3 : 0));

    expect(getPluralizationIndex('xx-test-plural', 5)).toBe(0);
    expect(getPluralizationIndex('xx-test-plural', 11)).toBe(3);
  });

  test('registers under the primary subtag, so a regional tag resolves to it', () => {
    registerPluralRule('yy-test-plural', () => 7);

    expect(getPluralizationIndex('yy-test-plural-variant', 1)).toBe(7);
  });
});
