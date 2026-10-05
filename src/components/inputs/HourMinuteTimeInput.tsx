import { cn } from '@/util/cn';
import { TimePartInput } from './TimePartInput';

/**
 * An hour and a minute as two {@link TimePartInput}s, hours in 24-hour form.
 *
 * Two numbers rather than one string, so the caller holds a time it can do arithmetic on and does not
 * have to parse `"13:45"` back apart. The separator is rendered between the two fields and is not part
 * of either value.
 */
export function HourMinuteTimeInput({
  hour,
  onHourChange,
  minute,
  onMinuteChange,
  className,
}: {
  readonly hour: number;
  readonly onHourChange: (hour: number) => void;
  readonly minute: number;
  readonly onMinuteChange: (minute: number) => void;
  readonly className?: string | undefined;
}): React.JSX.Element {
  return (
    <div className={cn('flex gap-2 items-center', className)}>
      <TimePartInput value={hour} onChange={onHourChange} max={23} />
      <div>:</div>
      <TimePartInput value={minute} onChange={onMinuteChange} max={59} />
    </div>
  );
}
