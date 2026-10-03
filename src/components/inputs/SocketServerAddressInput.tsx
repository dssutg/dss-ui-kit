import { TextInput } from './TextInput';

/**
 * A text field for the address of a WebSocket server.
 *
 * The address is validated by shape rather than resolved, because where the server is lives in the
 * caller's environment, not in the library: the placeholder is theirs to set, and is omitted by
 * default rather than defaulting to a loopback address that would be wrong in a deployment.
 */
export interface SocketServerAddressInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onConfirm: () => void;
  /** The address to show while the field is empty. Nothing is shown when this is absent. */
  readonly placeholder?: string | undefined;
}

export function SocketServerAddressInput({
  value,
  onChange,
  onConfirm,
  placeholder,
}: SocketServerAddressInputProps) {
  return (
    <TextInput
      value={value}
      placeholder={placeholder}
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
