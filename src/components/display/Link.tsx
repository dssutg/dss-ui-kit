/**
 * What {@link Link} takes.
 *
 * `onNavigate` is how the library avoids choosing a router: with it, activation is reported and the
 * application decides what a URL means; without it, the browser follows the `href`.
 */
export interface LinkProps {
  /** The destination. Rendered as the anchor's `href`. */
  readonly to: string;
  /**
   * Called when the link is activated.
   *
   * The library has no router and does not take one: navigating is the application's decision, so the
   * destination is reported and the consumer decides what it means. Pass `undefined` to let the
   * browser follow the `href` itself.
   */
  readonly onNavigate?: (to: string) => void;
  readonly onClick?: () => void;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly children?: React.ReactNode | undefined;
}

/**
 * A link styled as a button.
 *
 * Rendered as a real anchor so that the browser's own affordances — middle-click, open in a new tab,
 * the status bar preview — keep working. The library does not intercept navigation unless
 * {@link LinkProps.onNavigate} is given, because a component that navigates is a component that has
 * chosen the application's router for it.
 */
export function Link({
  to,
  onNavigate,
  onClick,
  className,
  style,
  children,
  ...properties
}: LinkProps) {
  return (
    <a
      href={to}
      className={className}
      style={{ fontSize: 'inherit', ...style }}
      onClick={() => {
        onNavigate?.(to);
        onClick?.();
      }}
      {...properties}
    >
      {children}
    </a>
  );
}
