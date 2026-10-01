import { useRef } from 'react';
import { useGranularEffect } from '@/lib/use_granular_effect';

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
}) {
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
      className={`
        bg-bpd text-tpl w-full flex-grow resize-none overflow-y-scroll rounded-2xl p-2 font-mono outline-none
        ${dontWrapLongLines ? 'overflow-x-scroll whitespace-pre' : ''}
      `}
      style={style}
      value={output}
      readOnly
    />
  );
}
