/**
 * Every prop of a native `<input>`, with the library's own styling as the default.
 *
 * The point of this component is that it adds no behaviour: a caller that wants `type`, `min`, `max`,
 * `pattern` or an `onChange` gets the DOM element's prop and its semantics, styled with the design
 * system's background, text and placeholder tokens. For the library's own text field, with clear and
 * password behaviour, use {@link TextInput}.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly className?: string | undefined;
}

/** A native input styled with the design system's tokens. See {@link InputProps}. */
export function Input({ ...rest }: InputProps) {
  return (
    <input
      className="bg-bin block rounded-lg p-1 h-fit text-tpl placeholder-tpd outline-none"
      {...rest}
    />
  );
}
