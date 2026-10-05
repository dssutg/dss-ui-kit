import type React from 'react';
import { matchPath, type PathMatch } from '@/util/routing';

/**
 * One entry of a {@link RouteSwitch}: the paths it answers to, and what it renders for them.
 */
export interface RouteDescriptor {
  /** A pattern, or a list of patterns, in the grammar of `matchPath`. */
  readonly path: string | readonly string[];
  /** Renders the route. Called only for the route that matched, and given what it bound. */
  readonly render: (match: PathMatch) => React.ReactNode;
}

/**
 * Renders the one route the current path addresses.
 *
 * The path is a prop and not something read from the location, because this is not a router: it holds
 * no history, listens to no navigation event and changes nothing when the path it was given is no
 * longer current. An application that routes owns the path, and this decides what that path means —
 * which is the half of routing that is a matter of data rather than of the browser.
 *
 * `render` is a function so that only the matching route is ever constructed. A route table holding
 * elements would build every page on every render to throw all but one away, and a page that reads
 * state while being constructed is a page that does work nobody asked for.
 *
 * The first entry whose patterns match wins, and nothing is rendered when none do — which is what a
 * caller with nothing to show for a path wants, and what a caller with something wants to say by giving
 * the fallback its own entry with the path `'*'`.
 *
 * The matched route is rendered inside a wrapper element, which exists so that `className` has
 * somewhere to go: the route's own markup belongs to the caller, and a component that renders
 * another component's element cannot hand it a class without either cloning it — losing to a fragment,
 * an array or a `null` — or asking the caller to thread a prop through `render`. The wrapper is the
 * cheap half of that trade. A caller whose layout does not want a node in the middle puts
 * `contents` on it, which keeps the wrapper in the accessibility tree and out of the layout.
 */
export interface RouteSwitchProps {
  /** The path to resolve, owned by the application's router. */
  readonly path: string;
  /** The routes, in the order they should be tried. */
  readonly routes: readonly RouteDescriptor[];
  /** Applied to the wrapper around the matched route. */
  readonly className?: string | undefined;
}

export function RouteSwitch({ path, routes, className }: RouteSwitchProps): React.ReactNode {
  for (const route of routes) {
    const match = matchPath(route.path, path);

    if (match !== null) {
      return <div className={className}>{route.render(match)}</div>;
    }
  }

  return null;
}
