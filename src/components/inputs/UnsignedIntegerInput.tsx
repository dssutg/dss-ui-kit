import { useCallback } from 'react';
import { cn } from '@/util/cn';
import { clamp } from '@/util/math';

/**
 * A number input restricted to integers in a range, clamped as it is typed.
 *
 * Every change is clamped rather than only on blur, so the value the caller holds is always in range
 * and a consumer does not have to defend against the out-of-range case. `max` defaults to 100 because
 * that is what the fields it grew up with were for; a caller with a wider range passes it.
 */
export function UnsignedIntegerInput({
  value = 0,
  onChange,
  min = 0,
  max = 100,
  className,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly className?: string | undefined;
}): React.JSX.Element {
  const actualMin = Math.max(min, 0);
  const actualMax = Math.min(max, Number.MAX_SAFE_INTEGER);

  const incrementDecrement = useCallback(
    (isIncrement: boolean) => {
      let newValue = 0;
      if (isIncrement) {
        newValue = Math.min(value + 1, actualMax);
      } else {
        newValue = Math.max(value - 1, actualMin);
      }

      if (newValue.toString().includes('e')) {
        onChange?.(0);
      } else {
        onChange?.(newValue);
      }
    },
    [onChange, actualMin, actualMax, value],
  );

  return (
    <div className={cn('box-border flex w-32 min-w-full', className)}>
      <input
        type="number"
        pattern="[0-9]{10}"
        value={value}
        min={actualMin}
        max={actualMax}
        step="1"
        onChange={(e) => {
          let val = '0';
          if (e.currentTarget.value !== '' && !e.currentTarget.value.includes('e')) {
            val = e.currentTarget.value;
          }

          const x = parseInt(val, 10);

          e.currentTarget.value = x.toString();
          onChange?.(x);
        }}
        onKeyDown={(e) => {
          if (!/\d/.test(e.key)) {
            e.preventDefault();
          }
        }}
        onBlur={(e) => {
          const x = clamp(parseInt(e.currentTarget.value, 10), actualMin, actualMax);
          e.currentTarget.value = x.toString();
          onChange?.(x);
        }}
        className="bg-bin text-tpl m-0 box-border w-full appearance-none rounded-l-full border-none py-4 pl-4 pr-0 text-base outline-none"
      />
      <div className="bg-bin flex flex-col items-center justify-center gap-1 rounded-r-full pr-5">
        {Array.from({ length: 2 }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => incrementDecrement(index === 0)}
            className="text-tpd box-border cursor-pointer border-none bg-transparent p-0 text-base hover:brightness-150"
          >
            {index === 0 ? <>&#9650;</> : <>&#9660;</>}
          </button>
        ))}
      </div>
    </div>
  );
}
