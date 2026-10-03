import { TimePartInput } from './input_internal';

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
}) {
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
