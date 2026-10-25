// SPDX-License-Identifier: MIT
// A coloured dot beside a text label.

import { cn } from '@/util/cn';

/** The tones a status indicator can carry. */
export const STATUS_TONES = ['ok', 'warning', 'error', 'neutral'] as const;

/** One tone in {@link STATUS_TONES}. */
export type StatusTone = (typeof STATUS_TONES)[number];

/** The dot and text classes each tone renders. */
export const statusToneClasses: Record<
  StatusTone,
  { readonly dot: string; readonly text: string }
> = {
  ok: { dot: 'bg-tok', text: 'text-tok' },
  warning: { dot: 'bg-tno', text: 'text-tno' },
  error: { dot: 'bg-tda', text: 'text-tda' },
  neutral: { dot: 'bg-tpd', text: 'text-tpd' },
};

/** What {@link StatusIndicator} takes. */
export interface StatusIndicatorProps {
  /** The tone the dot and the label carry. */
  readonly tone: StatusTone;
  /** The already-translated label. */
  readonly label: string;
  readonly className?: string | undefined;
}

/**
 * A small coloured dot beside a text label.
 *
 * The indicator maps no state: the caller chooses the {@link StatusTone} and hands over a label it has
 * already translated, because only the caller knows what a value means and which language it is read
 * in. The dot is decoration hidden from the accessibility tree, and the label is always rendered, so
 * the meaning never rests on colour alone.
 */
export function StatusIndicator({
  tone,
  label,
  className,
}: StatusIndicatorProps): React.JSX.Element {
  const classes = statusToneClasses[tone];

  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-full', classes.dot)} />
      <span className={classes.text}>{label}</span>
    </span>
  );
}
