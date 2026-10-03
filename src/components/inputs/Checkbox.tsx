import { useId } from 'react';
import { Icon } from '@/components/display/Icon';

export function Checkbox({
  checked,
  onChange,
  label,
  style,
  labelStyle,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly labelStyle?: React.CSSProperties | undefined;
}) {
  const id = useId();

  return (
    <div className="flex items-center select-none text-tpl" style={style}>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <label htmlFor={id} className="flex items-center cursor-pointer w-full">
        <div
          className={`
            transition-background flex size-5 cursor-pointer items-center justify-center rounded border-2 text-base duration-200 shrink-0
            ${checked ? 'border-bok bg-bok' : 'border-bin'}
          `}
        >
          {checked && (
            <Icon
              name="check"
              style={{
                fill: 'var(--color-bokt)',
                width: '0.75rem',
                height: '0.75rem',
              }}
            />
          )}
        </div>
        {label !== undefined && label !== null && label !== false && label !== '' && (
          <span className="ml-2" style={labelStyle}>
            {label}
          </span>
        )}
      </label>
    </div>
  );
}
