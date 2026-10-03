import { WshSpinner } from './WshSpinner';

export function Spinner({ style }: { readonly style?: React.CSSProperties }) {
  return <WshSpinner style={style} color="var(--color-tpl)" />;
}
