import { cn } from '@/util/cn';

/** What {@link LightRayOverlay} takes. */
export interface LightRayOverlayProps {
  /**
   * The image, as anything CSS accepts in `background-image`.
   *
   * The library does not bundle one: a picture is the application's asset, and an application that
   * ships it as a file, as an import or as a data URI of its own says so here. The image is centred
   * and covers the box, because that is what a ray across the whole viewport is drawn for.
   */
  readonly image: string;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}

/**
 * A decorative wash of light across the whole viewport, behind everything else.
 *
 * The overlay takes no clicks — it is decoration, and a decoration that intercepted the pointer would
 * stop an operator reaching the panel it is meant to sit behind. It carries no accessible name either:
 * it is hidden from the accessibility tree, because there is nothing in it an operator has to read.
 *
 * How bright it is is a default and not a decision: `opacity-[0.4]` is here so the panel in front of it
 * stays readable, and a caller who wants more or less passes their own `opacity-*` to `className`.
 */
export function LightRayOverlay({
  image,
  className,
  style,
}: LightRayOverlayProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed left-0 top-0 h-screen w-screen bg-cover bg-center opacity-[0.4]',
        className,
      )}
      style={{ backgroundImage: `url(${image})`, ...style }}
    />
  );
}
