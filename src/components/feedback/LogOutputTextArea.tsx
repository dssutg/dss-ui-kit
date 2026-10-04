import { useRef } from 'react';
import { cn } from '@/util/cn';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/**
 * A read-only text area for a stream of output, which follows the end as lines arrive.
 *
 * Read-only rather than a live region: a log an operator scrolls back through has to not steal the
 * keyboard, and a screen reader is better served by the surrounding panel than by an element that
 * announces every line. `shouldScrollToEndOnUpdate` exists because an operator reading back through a
 * log wants the scroll position kept.
 */
export function LogOutputTextArea({
  output,
  dontWrapLongLines = false,
  style,
  shouldScrollToEndOnUpdate = false,
}: {
  readonly output: string;
  readonly dontWrapLongLines?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
  readonly shouldScrollToEndOnUpdate?: boolean | undefined;
}): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useGranularEffect(
    () => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      if (
        shouldScrollToEndOnUpdate ||
        textarea.scrollHeight - (textarea.scrollTop + textarea.clientHeight) < 200
      ) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    },
    [output, textareaRef, shouldScrollToEndOnUpdate],
    [],
  );

  return (
    <textarea
      ref={textareaRef}
      className={cn(
        'bg-bpd text-tpl w-full flex-grow resize-none overflow-y-scroll rounded-2xl p-2 font-mono outline-none',
        dontWrapLongLines && 'overflow-x-scroll whitespace-pre',
      )}
      style={style}
      value={output}
      readOnly
    />
  );
}
