import { clamp } from '@/lib/math';
import { TextInput } from '@/ui/TextInput';

export function ByteFractionInput({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
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
      width="100%"
    />
  );
}
