/**
 * The largest spinner in the set: a wide arc drawn inside a fixed 112-pixel box.
 *
 * The box is fixed so the spinner does not resize the panel around it while it is showing — a
 * spinner that changes layout is a layout shift on every mount. `color` defaults to a literal grey
 * rather than a token because it is the one spinner used as a placeholder image for a panel.
 */
export function WshSpinner({
  color = '#ddd',
  style,
}: {
  readonly color?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
  return (
    <div
      className="opacity-1 flex h-28 w-28 shrink-0 justify-center"
      style={
        {
          '--color': color,
          ...style,
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none relative w-16">
        <div>
          <div className="animate-wsh-spinner-container pointer-events-none absolute left-[50%] top-[50%] -ml-[50%] -mt-[50%] w-full pb-[100%]">
            <div className="animate-wsh-spinner-rotator absolute h-full w-full">
              <div className="absolute bottom-0 left-0 right-[49%] top-0 overflow-hidden">
                <div className="animate-wsh-spinner-left absolute -right-[100%] left-0 box-border h-full w-[200%] rounded-full border-[6px] border-b-[transparent] border-l-[var(--color)] border-r-transparent border-t-[var(--color)]" />
              </div>
              <div className="absolute bottom-0 left-[49%] right-0 top-0 overflow-hidden">
                <div className="animate-wsh-spinner-right absolute -left-[100%] right-0 box-border h-full w-[200%] rounded-full border-[6px] border-b-[transparent] border-l-transparent border-r-[var(--color)] border-t-[var(--color)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
