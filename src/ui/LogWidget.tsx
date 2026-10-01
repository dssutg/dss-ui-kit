import { useLocale } from '@/locale';
import { IconButton } from '@/ui/IconButton';
import { LogOutputTextArea } from '@/ui/LogOutputTextArea';
import { PlayPauseButton } from '@/ui/PlayPauseButton';

export function LogWidget({
  title,
  playing,
  output,
  onPlayClick,
  onPauseClick,
  onClearClick,
  extraLeftControlsComponent,
  extraRightControlsComponent,
  style,
  className,
}: {
  readonly title: string;
  readonly playing: boolean;
  readonly output: string;
  readonly onPlayClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly onPauseClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly onClearClick: React.MouseEventHandler<HTMLButtonElement>;
  readonly extraLeftControlsComponent?: React.ReactNode | undefined;
  readonly extraRightControlsComponent?: React.ReactNode | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly className?: string | undefined;
}) {
  const { t } = useLocale();

  return (
    <div
      className={`bg-bpd flex flex-grow flex-col overflow-hidden rounded-2xl p-4 ${className}`}
      style={style}
    >
      <div className="flex justify-between">
        <div className="flex">
          <PlayPauseButton
            playTitle={t('LogWidget.enableMessageOutput')}
            pauseTitle={t('LogWidget.disableMessageOutput')}
            playing={playing}
            onClick={playing ? onPauseClick : onPlayClick}
          />
          <IconButton
            icon="clear"
            iconClassName="fill-tda size-6"
            className="ml-2 rounded-full p-1 sm:ml-10"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('LogWidget.clearMessageOutput')}
            onClick={onClearClick}
          />
          {extraLeftControlsComponent}
        </div>
        <div className="text-tpl flex-grow text-center truncate select-none">{title}</div>
        <div>{extraRightControlsComponent}</div>
      </div>
      <LogOutputTextArea
        output={output}
        style={{ marginTop: '0.5rem', borderRadius: 0, padding: 0 }}
      />
    </div>
  );
}
