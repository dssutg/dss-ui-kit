import { WshSpinner } from './WshSpinner';

/**
 * A single arc rotating, for work whose duration is not known.
 *
 * The smallest indeterminate indicator the set has; {@link ContinuousCircleSpinner} is the one that
 * reads as motion when there is something to look at while waiting.
 */
export function Spinner({ style }: { readonly style?: React.CSSProperties }): React.JSX.Element {
  return <WshSpinner style={style} color="var(--color-tpl)" />;
}
