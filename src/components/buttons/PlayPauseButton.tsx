import { IconButton } from './IconButton';

/**
 * The round play/pause toggle used by the playback controls.
 *
 * `playing` is the state, not an intent: the button shows what is true now and calls `onClick` to ask
 * for a change, so a caller that ignores the request sees no state flip. The titles are the label of
 * the action the click will perform, which is why they swap with `playing`.
 */
export interface PlayPauseButtonProps {
  readonly playing: boolean;
  readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly playTitle: string;
  readonly pauseTitle: string;
}

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
