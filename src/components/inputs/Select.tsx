import { useTheme } from '@/theme';
import { cn } from '@/util/cn';
import { getCSSVariableValue } from '@/util/color';

/**
 * A styled `<select>`, themed to the library's own input look.
 *
 * The chevron is drawn from the current theme's token rather than shipped as an asset, so it is
 * correct in every theme without a second copy of the icon. It is a native select on purpose: the
 * dropdown list is the browser's, which is the one part of a select that cannot be made to look right
 * and is the part an operator relies on.
 */
export function Select({
  value,
  onChange,
  style,
  disabled,
  id,
  children,
}: {
  readonly value: string;
  readonly onChange: React.ChangeEventHandler<HTMLSelectElement>;
  readonly style?: React.CSSProperties | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  useTheme();

  const encodedColor = encodeURIComponent(getCSSVariableValue('color-tpl'));

  return (
    <select
      id={id}
      tabIndex={0}
      className={cn(
        'hover:filter-brightness-150 bg-bin text-tpl w-max h-fit cursor-pointer appearance-none rounded-lg border-none bg-right bg-no-repeat py-1 pl-2 pr-8',
        disabled && 'pointer-events-none',
      )}
      style={{
        backgroundImage: `url('data:image/svg+xml;utf8,<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10.127L12 18.127L20 10.127H4Z" fill="${encodedColor}"/></svg>')`,
        ...style,
      }}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {children}
    </select>
  );
}
