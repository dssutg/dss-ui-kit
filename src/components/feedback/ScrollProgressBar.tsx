import { useDocumentScrollPercentage } from '@/lib/use_document_scroll_percentage';

/**
 * A two-pixel bar showing how far through the document the reader is.
 *
 * It reads the whole document, not a scroll container, and takes no props: a bar for an arbitrary
 * scrollable element would need a ref to one, and the caller wrapping it in its own container with
 * `position: sticky` gets the same result.
 */
export function ScrollProgressBar() {
  const percent = useDocumentScrollPercentage();

  return (
    <div className="bg-bpd h-[2px] w-full">
      <div
        className="h-full w-0 bg-[var(--color-scroll-progress-bar)]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
