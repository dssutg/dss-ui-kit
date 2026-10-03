/**
 * Tests for the HTTP status catalogue: the numeric codes, how they sort into the five categories
 * by their hundreds digit, and the display names reported for codes and categories. A failure
 * here would mean the UI names an HTTP failure wrongly, or crashes on a code outside the table.
 */

import { describe, expect, test } from 'vitest';
import {
  getHttpStatusCategory,
  getHttpStatusCategoryName,
  getHttpStatusName,
  HttpStatus,
  HttpStatusCategory,
  httpCategories,
  httpStatusCategoryNames,
  httpStatusNames,
} from './';

/** The hundreds digit alone decides the category, for listed codes and for ones that are not. */
describe('getHttpStatusCategory', () => {
  test('names a category from the hundreds digit', () => {
    expect(getHttpStatusCategory(100)).toBe(HttpStatusCategory.INFORMATIONAL);
    expect(getHttpStatusCategory(HttpStatus.OK)).toBe(HttpStatusCategory.SUCCESSFUL);
    expect(getHttpStatusCategory(HttpStatus.NotFound)).toBe(HttpStatusCategory.CLIENT_ERROR);
    expect(getHttpStatusCategory(503)).toBe(HttpStatusCategory.SERVER_ERROR);
    expect(getHttpStatusCategory(HttpStatus.MovedPermanently)).toBe(HttpStatusCategory.REDIRECTION);
  });

  test('works for a code the table does not list', () => {
    expect(getHttpStatusCategory(499)).toBe(HttpStatusCategory.CLIENT_ERROR);
  });

  test('returns null outside the five categories', () => {
    expect(getHttpStatusCategory(99)).toBeNull();
    expect(getHttpStatusCategory(600)).toBeNull();
    expect(getHttpStatusCategory(0)).toBeNull();
  });
});

/** A listed code is named from the catalogue; an unlisted one is named "Unknown", never undefined. */
describe('getHttpStatusName', () => {
  test('names the codes the table lists, with their IANA names', () => {
    expect(getHttpStatusName(HttpStatus.OK)).toBe('OK');
    expect(getHttpStatusName(HttpStatus.NotFound)).toBe('Not Found');
    expect(getHttpStatusName(HttpStatus.IAmATeapot)).toBe("I'm a teapot");
  });

  test('names every catalogue entry', () => {
    for (const [code, name] of Object.entries(httpStatusNames)) {
      expect(getHttpStatusName(Number(code))).toBe(name);
    }
  });

  test('reports an unlisted code as unknown rather than returning undefined', () => {
    expect(getHttpStatusName(599)).toBe('Unknown HTTP status code 599');
  });
});

/** Category display names for listed codes, and an "Unknown" wording for codes with no category. */
describe('getHttpStatusCategoryName', () => {
  test('names the category of a listed code', () => {
    expect(getHttpStatusCategoryName(HttpStatus.OK)).toBe('Successful');
    expect(getHttpStatusCategoryName(500)).toBe('Server Error');
  });

  test('reports a code with no category as unknown rather than returning undefined', () => {
    expect(getHttpStatusCategoryName(600)).toBe('Unknown category of HTTP status code 600');
  });
});

/** The category table stays in step with the names table: every category has a display name. */
describe('httpCategories', () => {
  test('carries a display name for every category', () => {
    for (const category of httpCategories) {
      expect(httpStatusCategoryNames[category]).toBeDefined();
    }
  });
});
