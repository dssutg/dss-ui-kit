import { clamp } from '@/util/math';
import { TextInput } from './TextInput';

/**
 * A text input for a byte count with a fractional part, in megabytes.
 *
 * Clamped to 25.5 MB and stepped in halves, because that is the range a caller of this input has
 * always had and the field would be wrong outside it. The unit is not rendered: the caller's label
 * says what the number means.
 */
export function ByteFractionInput({
  value,
  onChange,
  className,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly className?: string | undefined;
}): React.JSX.Element {
  const min = 0;
  const max = 25.5;

  return (
    <TextInput
      type="number"
      min={min}
      max={max}
      step={0.1}
      value={value.toString()}
      onChangeText={(value) => {
        onChange(clamp(Number(value.replace(/[^\d.]/g, '')) || 0, min, max));
      }}
      className={className}
      width="100%"
    />
  );
}
