import { useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { cn } from '@/util/cn';
import { useEventListener } from '@/util/hooks/use_event_listener';

/**
 * A button that scrolls the window back to the top, appearing only once the page has been scrolled.
 *
 * `minAppearanceY` is the scroll position at which it appears, so it does not cover content at the top
 * of a page that happens to be taller than the viewport. It scrolls the window, not a container: a
 * container-scoped one would need the container, and the caller with one can put this in it and style
 * it out of the way.
 */
export function ToTop({
  minAppearanceY = 300,
  className,
  style,
}: {
  readonly minAppearanceY?: number | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}): false | React.JSX.Element {
  const [visible, setVisible] = useState(false);

  useEventListener('scroll', () => {
    setVisible(window.scrollY >= minAppearanceY);
  });

  return (
    visible && (
      <IconButton
        onClick={() => window.scrollTo(0, 0)}
        icon="toTopArrow"
        iconClassName="size-14 fill-[var(--color-to-top-bg)]"
        className={cn(
          'animate-fade-in fixed bottom-20 right-3 [clip-path:circle(50%_at_center)] sm:bottom-12 sm:right-8',
          className,
        )}
        style={style}
        rippleColor="var(--color-ripple-icon-button)"
      />
    )
  );
}
