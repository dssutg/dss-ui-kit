import type React from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { useLocale } from '@/locale';

/** What a breadcrumb is joined with, between a title and the path of titles leading to it. */
export const NAV_BAR_BREADCRUMB_SEPARATOR = ' / ';

/**
 * The bar across the top of an application: a menu button, a title, and whatever the caller puts at
 * its right.
 *
 * The title is split into the root title and the breadcrumb rather than being one string, because a
 * caller holding a menu knows the current item and not the text to say about it — the text belongs to
 * the menu item, and joining it here keeps that in one place instead of in every caller that renders a
 * title. A caller with no menu to describe its position passes `rootTitle` alone.
 *
 * The button is rendered only when `onMenuClick` is given, because a bar that opens something is not
 * a bar that every caller has.
 */
export function NavBar({
  onMenuClick,
  rootTitle,
  breadcrumb = [],
  children,
  className,
}: {
  readonly onMenuClick?: React.MouseEventHandler<HTMLButtonElement> | undefined;
  readonly rootTitle: string;
  readonly breadcrumb?: readonly string[] | undefined;
  readonly children?: React.ReactNode | undefined;
  readonly className?: string | undefined;
}) {
  const { t } = useLocale();

  return (
    <div className={`bg-bpd flex h-12 w-full shrink-0 items-center shadow-lg ${className}`}>
      {onMenuClick !== undefined && (
        <IconButton
          icon="bars"
          iconClassName="fill-tpl size-6"
          className="ml-2 rounded-full p-1"
          title={t('NavBar.menu')}
          rippleColor="var(--color-ripple-icon-button)"
          onClick={onMenuClick}
        />
      )}
      <div className="text-tpl ml-2 hidden truncate select-none sm:block">
        {[rootTitle, ...breadcrumb].join(NAV_BAR_BREADCRUMB_SEPARATOR)}
      </div>
      {children}
    </div>
  );
}
