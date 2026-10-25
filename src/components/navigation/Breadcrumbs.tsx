// SPDX-License-Identifier: MIT
// A router-agnostic trail of links with an overflow fade.

import { Link } from '@/components/display/Link';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';

/** One step in a breadcrumb trail: where it leads and what the step is called. */
export interface BreadcrumbItem {
  readonly to: string;
  readonly label: string;
}

/** What {@link Breadcrumbs} takes. */
export interface BreadcrumbsProps {
  /** The trail, in order from the root to the current page. */
  readonly items: readonly BreadcrumbItem[];
  /**
   * Reports a plain click on an earlier step, so the caller's router decides what the destination
   * means. The library has no router; without a handler the browser follows the `href`.
   */
  readonly onNavigate?: ((to: string) => void) | undefined;
  /** What sits between two steps. Defaults to `'/'`. */
  readonly separator?: string | undefined;
  readonly className?: string | undefined;
  /** Applied to every step, including the current page. */
  readonly itemClassName?: string | undefined;
  /** Whether the right edge fades out when the trail does not fit. Defaults to `true`. */
  readonly fade?: boolean | undefined;
}

/**
 * A trail of links from a root to the current page.
 *
 * The caller supplies the items and handles navigation: the library has no router, so an earlier
 * step is a plain {@link Link} that reports its destination through
 * {@link BreadcrumbsProps.onNavigate}, and the last item is the current page, rendered as text
 * rather than a link. When the trail is wider than its container, the right edge fades so a step
 * cut off mid-word reads as continuing rather than as the end; pass `fade={false}` for a trail
 * that must stay fully legible.
 */
export function Breadcrumbs({
  items,
  onNavigate,
  separator = '/',
  className,
  itemClassName,
  fade = true,
}: BreadcrumbsProps): React.JSX.Element {
  const { t } = useLocale();

  return (
    <nav
      aria-label={t('Breadcrumbs.label')}
      className={cn('overflow-hidden', className)}
      style={
        fade
          ? { maskImage: 'linear-gradient(to right, black calc(100% - 2rem), transparent)' }
          : undefined
      }
    >
      <ol className="m-0 flex items-center p-0 list-none">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.to} className={cn('whitespace-nowrap', itemClassName)}>
              {isLast ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <Link
                  to={item.to}
                  onNavigate={onNavigate}
                  className="text-tpl no-underline hover:underline hover:brightness-75"
                >
                  {item.label}
                </Link>
              )}
              {isLast ? null : (
                <span aria-hidden="true" className="mx-2 text-tpd">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
