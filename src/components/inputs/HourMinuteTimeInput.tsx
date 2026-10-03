import { TimePartInput } from './TimePartInput';

export function HourMinuteTimeInput({
  hour,
  onHourChange,
  minute,
  onMinuteChange,
}: {
  readonly hour: number;
  readonly onHourChange: (hour: number) => void;
  readonly minute: number;
  readonly onMinuteChange: (minute: number) => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      <TimePartInput value={hour} onChange={onHourChange} max={23} />
      <div>:</div>
      <TimePartInput value={minute} onChange={onMinuteChange} max={59} />
    </div>
  );
}
