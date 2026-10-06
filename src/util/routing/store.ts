import { createStore } from '@/util/store';

/** What {@link createRoutingStore} is told about the paths an application answers to. */
export interface RoutingStoreOptions {
  /**
   * The paths the address bar may name when the store is created.
   *
   * The store has no server-side routing behind it, so anything the URL holds was either put there
   * by the application or by a reload, and a path nothing renders resolves to
   * {@link RoutingStoreOptions.fallbackPath} rather than to an empty screen. Omit this to take the
   * URL's pathname as it stands — the caller then owns what a stray path renders.
   */
  readonly knownPaths?: readonly string[] | undefined;
  /** The path an unknown URL resolves to. `/` unless the caller says otherwise. */
  readonly fallbackPath?: string | undefined;
  /**
   * Whether a route change scrolls the page back to the top. On unless the caller says otherwise:
   * with a fixed header above it, a route that arrived mid-scroll would leave the new section read
   * from the wrong place.
   */
  readonly scrollOnRouteChange?: boolean | undefined;
}

/**
 * The current routing path, held as state: where the application is, and the one way to move it.
 *
 * The path is written rather than pushed — the store holds no history and listens to no navigation
 * event — because this is not a router: it is the state a router's user would read, in the form
 * {@link RouteSwitch} resolves. An application that also wants the URL to follow writes
 * `window.history` beside {@link RoutingStore.routeTo} itself; nothing here does it for them.
 */
export interface RoutingStore {
  /** Moves to `path`, scrolling home — unless the path already held, which is a no-op. */
  routeTo(path: string): void;
  /** The current path, for a reader outside React. */
  getRoutingPath(): string;
  /** The current path, re-rendering the component when it changes. */
  useRoutingPath(): string;
}

/**
 * The path the URL holds when the store is created: a known one if it names one, and the fallback
 * otherwise. See {@link RoutingStoreOptions.knownPaths}.
 */
function readInitialPath(options: RoutingStoreOptions): string {
  const { knownPaths, fallbackPath = '/' } = options;
  const pathname = window.location.pathname;

  if (knownPaths === undefined || knownPaths.includes(pathname)) {
    return pathname;
  }

  return fallbackPath;
}

/**
 * Creates the store that holds the application's routing path.
 *
 * A store rather than module state because the paths are the caller's: two applications, two
 * tests, two different answers to "which paths exist", with no constant in this library deciding
 * for either. The store reads the URL once, at creation, and never again — a caller that wants the
 * path to follow the browser owns that decision too.
 */
export function createRoutingStore(options: RoutingStoreOptions = {}): RoutingStore {
  const { scrollOnRouteChange = true } = options;
  const store = createStore({ routingPath: readInitialPath(options) });

  return {
    routeTo(path) {
      if (store.getState().routingPath === path) {
        return;
      }

      store.setState({ routingPath: path });

      if (scrollOnRouteChange) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    },

    getRoutingPath: () => store.getState().routingPath,

    useRoutingPath: () => store.useSelector((state) => state.routingPath),
  };
}
