import { cn } from '@/util/cn';
import { useDocumentScrollPercentage } from '@/util/hooks/use_document_scroll_percentage';

/**
 * A two-pixel bar showing how far through the document the reader is.
 *
 * It reads the whole document, not a scroll container, and takes no positioning props: a bar for an
 * arbitrary scrollable element would need a ref to one, and the caller wrapping it in its own container
 * with `position: sticky` gets the same result.
 */
export function ScrollProgressBar({
  className,
}: {
  readonly className?: string | undefined;
}): React.JSX.Element {
  const percent = useDocumentScrollPercentage();

  return (
    <div className={cn('bg-bpd h-[2px] w-full', className)}>
      <div
        className="h-full w-0 bg-[var(--color-scroll-progress-bar)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
