export function ContinuousCircleSpinner({ style }: { readonly style?: React.CSSProperties }) {
  return (
    <div
      className="leading-0 aspect-square size-[2em] animate-spin rounded-full border-[5px] border-[var(--color-loading-spinner-bg)] border-b-[var(--color-loading-spinner-fg)] bg-transparent text-[2rem]"
      style={style}
    />
  );
}
