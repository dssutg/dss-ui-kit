import { TimePartInput } from './TimePartInput';

/**
 * An hour, a minute and a second as three {@link TimePartInput}s.
 *
 * The same shape as {@link HourMinuteTimeInput} with a seconds field, for a duration an operator
 * watches rather than a time of day.
 */
export function HourMinuteSecondTimeInput({
  hour,
  onHourChange,
  minute,
  onMinuteChange,
  second,
  onSecondChange,
}: {
  readonly hour: number;
  readonly onHourChange: (hour: number) => void;
  readonly minute: number;
  readonly onMinuteChange: (minute: number) => void;
  readonly second: number;
  readonly onSecondChange: (second: number) => void;
}): React.JSX.Element {
  return (
    <div className="flex gap-2 items-center">
      <TimePartInput value={hour} onChange={onHourChange} max={23} />
      <div>:</div>
      <TimePartInput value={minute} onChange={onMinuteChange} max={59} />
      <div>:</div>
      <TimePartInput value={second} onChange={onSecondChange} max={59} />
    </div>
  );
}
