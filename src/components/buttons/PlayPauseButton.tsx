import { IconButton } from './IconButton';

/**
 * The round play/pause toggle used by the playback controls.
 *
 * `playing` is the state, not an intent: the button shows what is true now and calls `onClick` to ask
 * for a change, so a caller that ignores the request sees no state flip. The titles are the label of
 * the action the click will perform, which is why they swap with `playing`.
 */
/**
 * What {@link PlayPauseButton} takes.
 *
 * The two titles are separate props because they are two different strings an operator reads, and
 * the library does not have either of them: a component does not invent user-facing text.
 */
export interface PlayPauseButtonProps {
  readonly playing: boolean;
  readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly playTitle: string;
  readonly pauseTitle: string;
}

/**
 * One button that shows a play icon when paused and a pause icon when playing.
 *
 * It holds no state: `playing` is the caller's, so the same button works for a stream, a recording
 * and a timeline, and an external pause still updates the icon.
 */
export function PlayPauseButton({ playing, onClick, playTitle, pauseTitle }: PlayPauseButtonProps) {
  return (
    <IconButton
      icon={playing ? 'pause' : 'play'}
      title={playing ? pauseTitle : playTitle}
      className="rounded-full p-1"
      iconClassName={`size-6 ${playing ? 'fill-tda' : 'fill-tok'}`}
      rippleColor="var(--color-ripple-icon-button)"
      onClick={onClick}
    />
  );
}
