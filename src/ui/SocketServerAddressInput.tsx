import { TextInput } from '@/ui/TextInput';

export function SocketServerAddressInput({
  value,
  onChange,
  onConfirm,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onConfirm: () => void;
}) {
  return (
    <TextInput
      value={value}
      placeholder="ws://127.0.0.1:9000"
      onChange={(e) => onChange(e.currentTarget.value)}
      onClearClick={() => onChange('')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onConfirm();
        }
      }}
    />
  );
}
