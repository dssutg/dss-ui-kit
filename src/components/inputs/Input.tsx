import { cn } from '@/util/cn';

/**
 * Every prop of a native `<input>`, with the library's own styling as the default.
 *
 * The point of this component is that it adds no behaviour: a caller that wants `type`, `min`, `max`,
 * `pattern` or an `onChange` gets the DOM element's prop and its semantics, styled with the design
 * system's background, text and placeholder tokens. For the library's own text field, with clear and
 * password behaviour, use {@link TextInput}.
 *
 * `className` is narrowed to a plain string and destructured out rather than left in `...rest`: the DOM
 * attribute type admits a signal, which a real `<input>` cannot render, and a spread puts the caller's
 * value after the element's own `className` and replaces it. An input styled by this component and then
 * handed `className="w-full"` came out with no background, no radius and no placeholder colour at all.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly className?: string | undefined;
}

/** A native input styled with the design system's tokens. See {@link InputProps}. */
export function Input({ className, ...rest }: InputProps): React.JSX.Element {
  return (
    <input
      {...rest}
      className={cn(
        'bg-bin block rounded-lg p-1 h-fit text-tpl placeholder-tpd outline-none',
        className,
      )}
    />
  );
}
