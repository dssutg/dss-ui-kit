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

describe('getHttpStatusCategoryName', () => {
  test('names the category of a listed code', () => {
    expect(getHttpStatusCategoryName(HttpStatus.OK)).toBe('Successful');
    expect(getHttpStatusCategoryName(500)).toBe('Server Error');
  });

  test('reports a code with no category as unknown rather than returning undefined', () => {
    expect(getHttpStatusCategoryName(600)).toBe('Unknown category of HTTP status code 600');
  });
});

describe('httpCategories', () => {
  test('carries a display name for every category', () => {
    for (const category of httpCategories) {
      expect(httpStatusCategoryNames[category]).toBeDefined();
    }
  });
});
