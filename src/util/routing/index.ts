import { parseDSV, serializeDSV } from '@/util/dsv';

/**
 * Slash-separated path helpers: split one, match a pattern against it, and build one.
 *
 * Nothing here navigates. There is no history, no location and no listener — a caller owns the current
 * path and passes it in, and these functions only say what it means. The patterns, the parameters and
 * the order of a dispatch table are the caller's too, because only the caller knows what its paths
 * address.
 */

/** The parameters a matched path pattern bound, by parameter name. */
export interface PathMatch {
  readonly params: Readonly<Record<string, string>>;
}

/**
 * The components of a path, with the surrounding slashes and any escaping removed.
 *
 * `/` and `` are both the root, and both come back as an empty list rather than as a single empty
 * component: a root path that matched itself as a component named `''` would make every comparison
 * depend on how the caller spelled it.
 */
export function parsePathComponents(path: string): string[] {
  return parseDSV(path.replace(/^\/+/, '').replace(/\/+$/, ''), '/').columns;
}

/**
 * What one pattern component says about the path component in its place: a `:` prefix binds a
 * parameter, anything else is matched literally, and an empty string means the component matched
 * without binding a name.
 *
 * `null` is the failure, and it is distinct from the empty string so a caller can tell "not this
 * component" from "this component, which named nothing".
 */
function matchPatternComponent(patternComponent: string, pathComponent: string): string | null {
  if (patternComponent.startsWith(':')) {
    return patternComponent.slice(1);
  }

  return patternComponent === pathComponent ? '' : null;
}

/**
 * One pattern against one path, with its parameters, or null when it does not match.
 *
 * Both sides are compared component by component, so a pattern cannot match a prefix of a path or a
 * prefix of it be taken for one. A `:` component binds whatever it matched, a final `*` stands for any
 * number of trailing components including none, and every other component has to be equal.
 */
function matchPathPattern(pattern: string, path: string): PathMatch | null {
  const pathComponents = parsePathComponents(path);
  const patternComponents = parsePathComponents(pattern);

  const params: Record<string, string> = {};

  const hasTailWildcard = patternComponents.at(-1) === '*';

  for (const [index, patternComponent] of patternComponents.entries()) {
    if (hasTailWildcard && patternComponent === '*') {
      return { params };
    }

    const pathComponent = pathComponents[index];

    if (pathComponent === undefined) {
      return null;
    }

    const parameterName = matchPatternComponent(patternComponent, pathComponent);

    if (parameterName === null) {
      return null;
    }

    if (parameterName !== '') {
      params[parameterName] = pathComponent;
    }
  }

  if (pathComponents.length !== patternComponents.length) {
    return null;
  }

  return { params };
}

/**
 * The first of several patterns that matches the path, with its parameters, or null when none do.
 *
 * The list is a convenience for the caller, not a second grammar: every pattern is tried in the order
 * given and the first match wins, so a caller whose patterns overlap and cares which wins keeps that
 * order outside this function.
 */
export function matchPath(pattern: string | readonly string[], path: string): PathMatch | null {
  if (typeof pattern === 'string') {
    return matchPathPattern(pattern, path);
  }

  for (const candidate of pattern) {
    const match = matchPathPattern(candidate, path);

    if (match !== null) {
      return match;
    }
  }

  return null;
}

export function getPathParam(match: PathMatch, name: string): string | undefined {
  return match.params[name];
}

/** One entry of a {@link PathDispatchTable}: the patterns it answers to, and what it returns. */
export interface PathDispatchEntry<T> {
  readonly path: string | readonly string[];
  readonly handler: (match: PathMatch) => T;
}

/** Paths in priority order, each with what it returns. */
export type PathDispatchTable<T> = readonly PathDispatchEntry<T>[];

/** Paths as keys, each with what it returns; tried in the object's own key order. */
export type PathDispatchMap<T> = Readonly<Record<string, (match: PathMatch) => T>>;

/** What {@link dispatchPath} and {@link dispatchPathMap} report: the handler's result, and whether it ran. */
export interface PathDispatchResult<T> {
  readonly result: T | null;
  readonly matched: boolean;
}

/**
 * The value one named component of a pattern bound, or undefined when it did not bind one.
 *
 * This is the only way to read a parameter, and it is a function rather than an index into
 * `match.params` because the names are the caller's: nothing in the pattern can be checked at compile
 * time against the caller's own idea of what its parameters are called, so the lookup has to say
 * plainly that a name the pattern did not use has no value rather than pretending to.
 */

/**
 * The first entry whose patterns match the path, run against them.
 *
 * A table rather than a chain of `if`s, so the routes of an application read as the list they are, in
 * the order they are tried.
 */
export function dispatchPath<T>(
  dispatchTable: PathDispatchTable<T>,
  path: string,
): PathDispatchResult<T> {
  for (const { path: entryPath, handler } of dispatchTable) {
    const match = matchPath(entryPath, path);

    if (match !== null) {
      return { result: handler(match), matched: true };
    }
  }

  return { result: null, matched: false };
}

/**
 * The first key of the map that matches the path, run against it.
 *
 * The same as {@link dispatchPath} for the common case of one handler per path, which reads better as
 * an object literal than as a list of pairs. Keys are tried in the object's own order, so a map whose
 * keys look numeric is not in the order it is written: those keys are ordered as integers by every
 * JavaScript engine, ahead of the rest.
 */
export function dispatchPathMap<T>(
  dispatchMap: PathDispatchMap<T>,
  path: string,
): PathDispatchResult<T> {
  for (const [entryPath, handler] of Object.entries(dispatchMap)) {
    const match = matchPath(entryPath, path);

    if (match !== null) {
      return { result: handler(match), matched: true };
    }
  }

  return { result: null, matched: false };
}

/**
 * One component written so that {@link parsePathComponents} reads it back as the same string.
 *
 * This is for the caller assembling a path out of parts of its own — a value in a template string, say
 * — where there is no row serializer around it to do the escaping. {@link buildPath} takes a list and
 * escapes each component itself; passing a component through here first would escape it twice.
 *
 * A number is written as its own text, because a component is usually a number written out by a caller
 * that has one rather than a string that looks like digits.
 */
export function escapePathComponent(component: string | number): string {
  if (typeof component === 'number') {
    return component.toString();
  }

  return component.replace(/\\/g, '\\\\').replace(/\//g, '\\/');
}

/**
 * The path addressing the components, with each component escaped.
 *
 * The escaping is {@link serializeDSV}'s and not {@link escapePathComponent}'s, because a component
 * holding a separator has to be escaped exactly once: escaping it here and again on the way out would
 * write a path that reads back as the escaped text rather than as the component. The leading slash is
 * part of the result rather than something a caller adds, because every path this library handles is
 * written the same way and a caller that had to remember which of them wanted the slash would
 * eventually build a path that matches nothing.
 */
export function buildPath(components: readonly (string | number)[]): string {
  return `/${serializeDSV(
    components.map((component) => String(component)),
    '/',
  )}`;
}

/**
 * Whether the child path is inside the parent one, at any depth.
 *
 * A prefix is not enough — `/abc` is a prefix of `/abcdef`, and treating that as containment would
 * make a menu highlight the wrong item — so the separator after the parent is what decides it.
 */
export function isChildPath(parentPath: string, childPath: string): boolean {
  return childPath.startsWith(parentPath) && childPath[parentPath.length] === '/';
}

/**
 * The number of separators in the path, ignoring escaped ones.
 *
 * This is the depth a menu indents by. Counting separators with `split` instead would report a path
 * holding a `/` inside one of its components as deeper than it is.
 */
export function getPathDepth(path: string): number {
  let depth = 0;
  let backslashRun = 0;

  for (const character of path) {
    if (character === '\\') {
      backslashRun++;
      continue;
    }

    if (character === '/' && backslashRun % 2 === 0) {
      depth++;
    }

    backslashRun = 0;
  }

  return depth;
}
