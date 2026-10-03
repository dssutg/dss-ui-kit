import type { IconName } from '@/components/display/Icon';
import { IconButton } from './IconButton';

export interface ToggleButtonOption<TValue extends string> {
  /** The value this option selects. */
  readonly value: TValue;
  /** The icon shown while this option is not selected. */
  readonly icon: IconName;
  /** Tooltip naming the option, and therefore what activating the button will do. */
  readonly title: string;
}

export interface ToggleButtonProps<TValue extends string> {
  /** The currently selected value. */
  readonly value: TValue;
  /** The mutually exclusive values, in the order they are cycled through. */
  readonly options: readonly ToggleButtonOption<TValue>[];
  /** Called with the newly selected value. The button never changes its own state. */
  readonly onChange: (value: TValue) => void;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly iconClassName?: string | undefined;
}

/**
 * A button that cycles through a set of mutually exclusive representations of the same thing — a line
 * chart against a ring, a list against a grid.
 *
 * The button is told which option is current and which are available rather than carrying a boolean of
 * its own, because the decision of what the alternatives are belongs to the caller and not to a
 * component library. Titles are supplied rather than looked up so that the button has no opinion about
 * what the options mean.
 */
export function ToggleButton<TValue extends string>({
  value,
  options,
  onChange,
  className,
  style,
  iconClassName,
}: ToggleButtonProps<TValue>) {
  const currentIndex = options.findIndex((option) => option.value === value);
  const current = options[currentIndex];

  // A toggle whose value is not one of its own options has nothing to show and nowhere to switch to,
  // so this is a mistake in the call rather than a state worth rendering.
  if (current === undefined) {
    throw new Error(`ToggleButton: "${value}" is not one of its options.`);
  }

  // `current` came out of `options`, so the list is not empty and this index is inside it.
  const next = options[(currentIndex + 1) % options.length] ?? current;

  return (
    <IconButton
      icon={current.icon}
      className={className}
      style={style}
      iconClassName={iconClassName}
      // The title names the option the button will switch to, which is what a toggle is asked.
      title={next.title}
      ariaLabel={next.title}
      onClick={() => onChange(next.value)}
    />
  );
}
