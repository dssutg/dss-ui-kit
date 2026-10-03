export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readonly className?: string | undefined;
}

export function Input({ ...rest }: InputProps) {
  return (
    <input
      className="bg-bin block rounded-lg p-1 h-fit text-tpl placeholder-tpd outline-none"
      {...rest}
    />
  );
}
