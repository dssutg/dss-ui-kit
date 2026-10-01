import { WshSpinner } from '@/ui/WshSpinner';

export function Spinner({ style }: { readonly style?: React.CSSProperties }) {
  return <WshSpinner style={style} color="var(--color-tpl)" />;
}
