import { cn } from '@/util/cn';
import { highlightText } from '@/util/highlight';
import { Editor } from './Editor';

/**
 * A text editor holding a JSON document, with the syntax highlighted and validity shown.
 *
 * It does not parse the document into an object: the editor holds the text the operator is typing and
 * reports it, and the caller decides what a valid document means. `highlightSyntax` can be turned off
 * for a large document, where colouring on every keystroke is the expensive part.
 */
export function JsonEditor({
  code,
  setCode,
  expandingTab = false,
  tabSize = 2,
  highlightSyntax = true,
  className,
  style,
}: {
  readonly code: string;
  readonly setCode: (code: string) => void;
  readonly expandingTab?: boolean | undefined;
  readonly tabSize?: number | undefined;
  readonly highlightSyntax?: boolean | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}): React.JSX.Element {
  return (
    <div className={cn('flex w-full gap-2 overflow-hidden', className)} style={style}>
      <div className="flex-grow overflow-scroll">
        <Editor
          value={code}
          onValueChange={setCode}
          highlight={() => {
            if (highlightSyntax) {
              return highlightText(code, 'json');
            }
            return code;
          }}
          tabSize={expandingTab ? tabSize : 1}
          insertSpaces={expandingTab}
          autoFocus
          textareaClassName="min-h-full font-mono outline-none"
          textareaStyle={{
            fontFamily: 'var(--font-mono)',
            outline: '2px solid transparent',
            outlineOffset: 2,
          }}
          preClassName="font-mono outline-none"
        />
      </div>
    </div>
  );
}
