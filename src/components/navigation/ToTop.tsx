import { useState } from 'react';
import { IconButton } from '@/components/buttons/IconButton';
import { useEventListener } from '@/lib/use_event_listener';

export function ToTop({
  minAppearanceY = 300,
  style,
}: {
  readonly minAppearanceY?: number | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
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
        className="animate-fade-in fixed bottom-20 right-3 [clip-path:circle(50%_at_center)] sm:bottom-12 sm:right-8"
        style={style}
        rippleColor="var(--color-ripple-icon-button)"
      />
    )
  );
}
