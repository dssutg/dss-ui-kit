import { cn } from '@/util/cn';

/**
 * A ring of dots chasing each other round, for work whose duration is not known.
 *
 * Indeterminate by construction: it does not take a percentage, because a spinner that could show
 * progress would be asked for progress instead. Sized by its own CSS, so a caller wanting a different
 * size sets `className` or `style`.
 */
export function ContinuousCircleSpinner({
  className,
  style,
}: {
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'leading-0 aspect-square size-[2em] animate-spin rounded-full border-[5px] border-[var(--color-loading-spinner-bg)] border-b-[var(--color-loading-spinner-fg)] bg-transparent text-[2rem]',
        className,
      )}
      style={style}
    />
  );
}
