import { getCSSVariableValue } from '@/lib/color';
import { useTheme } from '@/theme';

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
  readonly style?: React.CSSProperties;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly children: React.ReactNode;
}) {
  useTheme();

  const encodedColor = encodeURIComponent(getCSSVariableValue('color-tpl'));

  return (
    <select
      id={id}
      tabIndex={0}
      className={`
        hover:filter-brightness-150 bg-bin text-tpl w-max h-fit cursor-pointer appearance-none rounded-lg border-none bg-right bg-no-repeat py-1 pl-2 pr-8
        ${disabled ? 'pointer-events-none' : ''}
      `}
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
