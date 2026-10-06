/**
 * What {@link Link} takes.
 *
 * `onNavigate` is how the library avoids choosing a router: with it, a plain click is intercepted
 * and the destination is reported, so the application decides what a URL means; without it, the
 * browser follows the `href`.
 */
export interface LinkProps {
  /** The destination. Rendered as the anchor's `href`. */
  readonly to: string;
  /**
   * Called when the link is activated by a plain click — the left button with no modifier, the one
   * a person means.
   *
   * The library has no router and does not take one: navigating is the application's decision, so
   * the destination is reported and the consumer decides what it means. The click itself is
   * cancelled first, so the browser does not follow the `href` and reload the page out from under
   * the application. Pass `undefined` to let the browser follow the `href` itself.
   *
   * A click the browser keeps — middle-click, Ctrl-click, Shift-click, a modifier that opens a new
   * tab — is never reported and never cancelled: opening the destination apart from this page is
   * the browser's own affordance, and an application that intercepted it would be taking away a
   * thing its users asked for.
   */
  readonly onNavigate?: ((to: string) => void) | undefined;
  /** Called on every click, plain or modified, after {@link LinkProps.onNavigate} would have run. */
  readonly onClick?: (() => void) | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  /** The link's hover title, rendered as the anchor's `title`. */
  readonly title?: string | undefined;
  readonly children?: React.ReactNode | undefined;
}

/**
 * Whether a click is the plain one a person means: the left button, no modifier, and nothing else
 * having answered it already.
 */
function isPlainClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * A link to a destination the application owns.
 *
 * Rendered as a real anchor so that the browser's own affordances — middle-click, open in a new
 * tab, the status bar preview — keep working. A plain click is intercepted only when
 * {@link LinkProps.onNavigate} is given, because a component that navigates is a component that
 * has chosen the application's router for it; without a handler the link is an ordinary anchor.
 */
export function Link({
  to,
  onNavigate,
  onClick,
  className,
  style,
  title,
  children,
}: LinkProps): React.JSX.Element {
  return (
    <a
      href={to}
      className={className}
      title={title}
      style={{ fontSize: 'inherit', ...style }}
      onClick={(event) => {
        if (onNavigate !== undefined && isPlainClick(event)) {
          event.preventDefault();
          onNavigate(to);
        }

        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
