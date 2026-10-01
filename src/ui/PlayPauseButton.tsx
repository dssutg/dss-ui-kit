import { IconButton } from '@/ui/IconButton';

export function PlayPauseButton({
  playing,
  onClick,
  playTitle,
  pauseTitle,
}: {
  readonly playing: boolean;
  readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly playTitle: string;
  readonly pauseTitle: string;
}) {
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
