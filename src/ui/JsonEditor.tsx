import { Editor } from '@/lib/Editor';
import { highlightText } from '@/lib/highlight';

export function JsonEditor({
  code,
  setCode,
  expandingTab = false,
  tabSize = 2,
  highlightSyntax = true,
  style,
}: {
  readonly code: string;
  readonly setCode: (code: string) => void;
  readonly expandingTab?: boolean | undefined;
  readonly tabSize?: number | undefined;
  readonly highlightSyntax?: boolean | undefined;
  readonly style?: React.CSSProperties | undefined;
}) {
  return (
    <div className="flex w-full gap-2 overflow-hidden" style={style}>
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
          className="min-h-full font-mono outline-none"
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
