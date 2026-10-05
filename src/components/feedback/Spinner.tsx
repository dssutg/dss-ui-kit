import { WshSpinner } from './WshSpinner';

/**
 * A single arc rotating, for work whose duration is not known.
 *
 * The smallest indeterminate indicator the set has; {@link ContinuousCircleSpinner} is the one that
 * reads as motion when there is something to look at while waiting.
 */
export function Spinner({
  className,
  style,
}: {
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}): React.JSX.Element {
  return <WshSpinner className={className} style={style} color="var(--color-tpl)" />;
}
