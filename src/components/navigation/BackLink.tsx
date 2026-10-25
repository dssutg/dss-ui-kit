// SPDX-License-Identifier: MIT
// A compact link that returns to the previous section.

import { Icon, type IconName } from '@/components/display/Icon';
import { Link } from '@/components/display/Link';
import { useLocale } from '@/locale';
import { cn } from '@/util/cn';

/** What {@link BackLink} takes. */
export interface BackLinkProps {
  /** The destination, rendered as the anchor's `href`. */
  readonly to: string;
  /** Reports a plain click, so the caller's router decides what the destination means. */
  readonly onNavigate?: ((to: string) => void) | undefined;
  /** The visible hover title and the accessible name. Defaults to the translated `BackLink.title`. */
  readonly title?: string | undefined;
  /** The icon to render. Defaults to `'arrowLeft'`. */
  readonly icon?: IconName | undefined;
  readonly className?: string | undefined;
}

/**
 * A link back to the previous section, drawn as an arrow and labelled for assistive technology.
 *
 * The arrow carries no accessible name of its own, so the same text is rendered in a visually hidden
 * span: an icon-only link is still announced as the action it performs. It is router-agnostic — the
 * destination is passed to {@link Link}, and a plain click is reported through `onNavigate` when the
 * caller has a router to handle it.
 */
export function BackLink({
  to,
  onNavigate,
  title,
  icon = 'arrowLeft',
  className,
}: BackLinkProps): React.JSX.Element {
  const { t } = useLocale();
  const label = title ?? t('BackLink.title');

  return (
    <Link
      to={to}
      onNavigate={onNavigate}
      title={label}
      className={cn(
        'inline-flex items-center justify-center text-tli no-underline hover:brightness-125',
        className,
      )}
    >
      <Icon name={icon} className="size-6 fill-current" />
      <span className="sr-only">{label}</span>
    </Link>
  );
}
