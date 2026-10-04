/**
 * The path helpers are the part of routing that has no React in it, so the suite can state exactly
 * what a path means: which patterns match it, which parameters they bind, and how a path is written
 * so it reads back the same. The two properties everything above them rests on are that a component
 * containing a separator survives a round trip, and that `*` matches the tail rather than a component
 * named `*`.
 */
import { describe, expect, test } from 'vitest';
import {
  buildPath,
  dispatchPath,
  dispatchPathMap,
  escapePathComponent,
  getPathDepth,
  getPathParam,
  isChildPath,
  matchPath,
  parsePathComponents,
} from './';

describe('parsePathComponents', () => {
  test('splits on the separators', () => {
    expect(parsePathComponents('/a/b/c')).toEqual(['a', 'b', 'c']);
  });

  test('reads the root as no components, however it is spelled', () => {
    expect(parsePathComponents('/')).toEqual([]);
    expect(parsePathComponents('')).toEqual([]);
  });

  test('drops the separators at both ends and keeps the ones inside', () => {
    expect(parsePathComponents('//a/b//')).toEqual(['a', 'b']);
  });

  test('keeps an escaped separator inside its component', () => {
    expect(parsePathComponents('/a/b\\/c/d')).toEqual(['a', 'b/c', 'd']);
  });
});

describe('matchPath', () => {
  test('matches a path against the same pattern and binds nothing', () => {
    expect(matchPath('/a/b', '/a/b')).toEqual({ params: {} });
  });

  test('does not match a different path', () => {
    expect(matchPath('/a/b', '/a/c')).toBeNull();
  });

  test('needs as many components as the pattern has', () => {
    expect(matchPath('/a', '/a/b')).toBeNull();
    expect(matchPath('/a/b', '/a')).toBeNull();
  });

  test('binds the value of a named component by its name without the colon', () => {
    expect(
      matchPath('/serverRack/:rackId/devices/:deviceId', '/serverRack/rack-1/devices/d-9'),
    ).toEqual({
      params: { rackId: 'rack-1', deviceId: 'd-9' },
    });
  });

  test('does not match a path with fewer components than the pattern names', () => {
    expect(matchPath('/a/:b', '/a')).toBeNull();
  });

  test('a trailing wildcard matches any tail, including none', () => {
    expect(matchPath('/a/*', '/a')).toEqual({ params: {} });
    expect(matchPath('/a/*', '/a/b')).toEqual({ params: {} });
    expect(matchPath('/a/*', '/a/b/c/d')).toEqual({ params: {} });
  });

  test('a trailing wildcard does not match what is above it', () => {
    expect(matchPath('/a/*', '/b/c')).toBeNull();
  });

  test('binds what came before the wildcard', () => {
    expect(matchPath('/a/:id/*', '/a/7/b')).toEqual({ params: { id: '7' } });
  });

  test('a wildcard alone matches every path, because a fallback route is written that way', () => {
    expect(matchPath('*', '/a/b')).toEqual({ params: {} });
    expect(matchPath('*', '/')).toEqual({ params: {} });
  });

  test('matches a component containing a separator against the same escaped pattern', () => {
    expect(matchPath('/a/b\\/c', '/a/b\\/c')).toEqual({ params: {} });
    expect(matchPath('/a/:component', '/a/b\\/c')).toEqual({ params: { component: 'b/c' } });
  });

  test('takes the first of several patterns that match', () => {
    expect(matchPath(['/a/:id', '/a/*'], '/a/7')).toEqual({ params: { id: '7' } });
  });

  test('is null when none of several patterns match', () => {
    expect(matchPath(['/a', '/b'], '/c')).toBeNull();
  });
});

describe('dispatchPath', () => {
  const dispatchTable = [
    {
      path: '/a/:id',
      handler: (match: { params: Readonly<Record<string, string>> }) =>
        `a:${getPathParam(match, 'id')}`,
    },
    { path: '/a/*', handler: () => 'a:rest' },
    { path: '/b', handler: () => 'b' },
  ];

  test('runs the handler of the first matching entry', () => {
    expect(dispatchPath(dispatchTable, '/a/7')).toEqual({ result: 'a:7', matched: true });
  });

  test('falls through to the next entry when the first does not match', () => {
    expect(dispatchPath(dispatchTable, '/a/7/8/9')).toEqual({ result: 'a:rest', matched: true });
  });

  test('reports nothing matched rather than throwing', () => {
    expect(dispatchPath(dispatchTable, '/c')).toEqual({ result: null, matched: false });
  });
});

describe('dispatchPathMap', () => {
  const dispatchMap = {
    '/a/:id': (match: { params: Readonly<Record<string, string>> }) =>
      `a:${getPathParam(match, 'id')}`,
    '/b': () => 'b',
  };

  test('runs the handler of the first matching key', () => {
    expect(dispatchPathMap(dispatchMap, '/b')).toEqual({ result: 'b', matched: true });
    expect(dispatchPathMap(dispatchMap, '/a/7')).toEqual({ result: 'a:7', matched: true });
  });

  test('reports nothing matched rather than throwing', () => {
    expect(dispatchPathMap(dispatchMap, '/c')).toEqual({ result: null, matched: false });
  });
});

describe('escapePathComponent', () => {
  test('escapes the separator and the escape character itself', () => {
    expect(escapePathComponent('a/b')).toBe('a\\/b');
    expect(escapePathComponent('a\\b')).toBe('a\\\\b');
  });

  test('writes a number as its own text', () => {
    expect(escapePathComponent(42)).toBe('42');
  });
});

describe('buildPath', () => {
  test('joins the components behind a leading separator', () => {
    expect(buildPath(['serverRack', 'rack-1'])).toBe('/serverRack/rack-1');
  });

  test('writes a number as a component', () => {
    expect(buildPath(['zone', 3])).toBe('/zone/3');
  });

  test('a component holding a separator survives the round trip', () => {
    const path = buildPath(['a', 'b/c', 'd']);

    expect(path).toBe('/a/b\\/c/d');
    expect(parsePathComponents(path)).toEqual(['a', 'b/c', 'd']);
  });

  test('a backslash in a component survives the round trip', () => {
    const path = buildPath(['a\\b']);

    expect(parsePathComponents(path)).toEqual(['a\\b']);
  });
});

describe('isChildPath', () => {
  test('is true for a path below the parent', () => {
    expect(isChildPath('/a', '/a/b')).toBe(true);
    expect(isChildPath('/a', '/a/b/c')).toBe(true);
  });

  test('is false for the path itself, which is not inside itself', () => {
    expect(isChildPath('/a', '/a')).toBe(false);
  });

  test('is false for a path that only starts with the same characters', () => {
    expect(isChildPath('/abc', '/abcdef')).toBe(false);
  });
});

describe('getPathDepth', () => {
  test('counts the separators', () => {
    expect(getPathDepth('/a/b/c')).toBe(3);
  });

  test('is zero for the root', () => {
    expect(getPathDepth('/')).toBe(1);
    expect(getPathDepth('')).toBe(0);
  });

  test('does not count an escaped separator', () => {
    expect(getPathDepth('/a/b\\/c/d')).toBe(3);
  });
});
