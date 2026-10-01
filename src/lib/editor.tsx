import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { useGranularEffect } from '@/lib/use_granular_effect';

type Padding<T> = T | { top?: T; right?: T; bottom?: T; left?: T };

interface EditorRecord {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

interface EditorHistory {
  stack: (EditorRecord & { timestamp: number })[];
  offset: number;
}

const KEYCODE_Y = 89;
const KEYCODE_Z = 90;
const KEYCODE_M = 77;
const KEYCODE_PARENS = 57;
const KEYCODE_BRACKETS = 219;
const KEYCODE_QUOTE = 222;
const KEYCODE_BACK_QUOTE = 192;

const HISTORY_LIMIT = 100;
const HISTORY_TIME_GAP = 3000;

const lineHeight = 20;

const isWindows =
  typeof window !== 'undefined' && 'navigator' in window && /win/i.test(navigator.platform);
const isMacLike =
  typeof window !== 'undefined' &&
  'navigator' in window &&
  /(mac|iphone|ipod|ipad)/i.test(navigator.platform);

const className = 'npm__react-simple-code-editor__textarea';

const cssText = `
/**
 * Reset the text fill color so that placeholder is visible
 */
.${className}:empty {
  -webkit-text-fill-color: inherit !important;
}
`;

export const Editor = forwardRef(
  (
    {
      autoFocus,
      disabled,
      form,
      highlight,
      ignoreTabKey = false,
      insertSpaces = true,
      maxLength,
      minLength,
      name,
      onBlur,
      onClick,
      onFocus,
      onKeyDown,
      onKeyUp,
      onValueChange,
      padding = 0,
      placeholder,
      preClassName,
      readOnly,
      required,
      style,
      tabSize = 2,
      textareaStyle,
      textareaId,
      value,
      className,
      ...rest
    }: {
      // Props for the component
      readonly highlight: (value: string) => string | React.ReactNode;
      readonly ignoreTabKey?: boolean | undefined;
      readonly insertSpaces?: boolean | undefined;
      readonly onValueChange: (value: string) => void;
      readonly padding?: Padding<number | string> | undefined;
      readonly style?: React.CSSProperties | undefined;
      readonly tabSize?: number | undefined;
      readonly value: string;

      // Props for the textarea
      readonly autoFocus?: boolean | undefined;
      readonly disabled?: boolean | undefined;
      readonly form?: string | undefined;
      readonly maxLength?: number | undefined;
      readonly minLength?: number | undefined;
      readonly name?: string | undefined;
      readonly onBlur?: React.FocusEventHandler<HTMLTextAreaElement> | undefined;
      readonly onClick?: React.MouseEventHandler<HTMLTextAreaElement> | undefined;
      readonly onFocus?: React.FocusEventHandler<HTMLTextAreaElement> | undefined;
      readonly onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement> | undefined;
      readonly onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement> | undefined;
      readonly placeholder?: string | undefined;
      readonly readOnly?: boolean | undefined;
      readonly required?: boolean | undefined;
      readonly textareaStyle?: React.CSSProperties | undefined;
      readonly textareaId?: string | undefined;

      // Props for the code pre element
      readonly preClassName?: string | undefined;

      readonly className?: string | undefined;
    },
    ref: React.Ref<null | { session: { history: EditorHistory } }>,
  ) => {
    const historyRef = useRef<EditorHistory>({
      stack: [],
      offset: -1,
    });
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [capture, setCapture] = useState(true);
    const contentStyle: React.CSSProperties = {
      paddingTop: typeof padding === 'object' ? padding.top : padding,
      paddingRight: typeof padding === 'object' ? padding.right : padding,
      paddingBottom: typeof padding === 'object' ? padding.bottom : padding,
      paddingLeft: typeof padding === 'object' ? padding.left : padding,
    };
    const highlighted = highlight(value);

    const getLines = useCallback((text: string, position: number) => {
      return text.slice(0, Math.max(0, position)).split('\n');
    }, []);

    const recordChange = useCallback(
      (record: EditorRecord, overwrite = false) => {
        const { stack, offset } = historyRef.current;

        if (stack.length && offset > -1) {
          // When something updates, drop the redo operations
          historyRef.current.stack = stack.slice(0, offset + 1);

          // Limit the number of operations to 100
          const count = historyRef.current.stack.length;

          if (count > HISTORY_LIMIT) {
            const extras = count - HISTORY_LIMIT;

            historyRef.current.stack = stack.slice(extras, count);
            historyRef.current.offset = Math.max(historyRef.current.offset - extras, 0);
          }
        }

        const timestamp = Date.now();

        if (overwrite) {
          const last = historyRef.current.stack[historyRef.current.offset];

          if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
            // A previous entry exists and was in short interval

            // Match the last word in the line
            const regex = /[^\da-z]([\da-z]+)$/i;

            // Get the previous line
            const previous = getLines(last.value, last.selectionStart).slice(-1)[0]?.match(regex);

            // Get the current line
            const current = getLines(record.value, record.selectionStart)
              .slice(-1)[0]
              ?.match(regex);

            const previousWord = previous?.[1];
            const currentWord = current?.[1];

            if (previousWord !== undefined && currentWord?.startsWith(previousWord)) {
              // The last word of the previous line and current line match
              // Overwrite previous entry so that undo will remove whole word
              historyRef.current.stack[historyRef.current.offset] = {
                ...record,
                timestamp,
              };

              return;
            }
          }
        }

        // Add the new operation to the stack
        historyRef.current.stack = [...historyRef.current.stack, { ...record, timestamp }];
        historyRef.current.offset = historyRef.current.offset + 1;
      },
      [getLines],
    );

    const updateInput = (record: EditorRecord) => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      // Update values and selection state
      input.value = record.value;
      input.selectionStart = record.selectionStart;
      input.selectionEnd = record.selectionEnd;

      onValueChange?.(record.value);
    };

    const applyEdits = (record: EditorRecord) => {
      // Save last selection state
      const input = inputRef.current;
      const last = historyRef.current.stack[historyRef.current.offset];

      if (last && input) {
        historyRef.current.stack[historyRef.current.offset] = {
          ...last,
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd,
        };
      }

      // Save the changes
      recordChange(record);
      updateInput(record);
    };

    const undoEdit = () => {
      const { stack, offset } = historyRef.current;

      // Get the previous edit
      const record = stack[offset - 1];

      if (record) {
        // Apply the changes and update the offset
        updateInput(record);
        historyRef.current.offset = Math.max(offset - 1, 0);
      }
    };

    const redoEdit = () => {
      const { stack, offset } = historyRef.current;

      // Get the next edit
      const record = stack[offset + 1];

      if (record) {
        // Apply the changes and update the offset
        updateInput(record);
        historyRef.current.offset = Math.min(offset + 1, stack.length - 1);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (onKeyDown) {
        onKeyDown(event);

        if (event.defaultPrevented) {
          return;
        }
      }

      if (event.key === 'Escape') {
        event.currentTarget.blur();
      }

      const { value, selectionStart, selectionEnd } = event.currentTarget;

      const tabCharacter = (insertSpaces ? ' ' : '\t').repeat(tabSize);

      if (event.key === 'Tab' && !ignoreTabKey && capture) {
        // Prevent focus change
        event.preventDefault();

        if (event.shiftKey) {
          // Unindent selected lines
          const linesBeforeCaret = getLines(value, selectionStart);
          const startLine = linesBeforeCaret.length - 1;
          const endLine = getLines(value, selectionEnd).length - 1;
          const nextValue = value
            .split('\n')
            .map((line, index) => {
              if (index >= startLine && index <= endLine && line.startsWith(tabCharacter)) {
                return line.slice(tabCharacter.length);
              }

              return line;
            })
            .join('\n');

          if (value !== nextValue) {
            const startLineText = linesBeforeCaret[startLine];

            applyEdits({
              value: nextValue,
              // Move the start cursor if first line in selection was modified
              // It was modified only if it started with a tab
              selectionStart: startLineText?.startsWith(tabCharacter)
                ? selectionStart - tabCharacter.length
                : selectionStart,
              // Move the end cursor by total number of characters removed
              selectionEnd: selectionEnd - (value.length - nextValue.length),
            });
          }
        } else if (selectionStart !== selectionEnd) {
          // Indent selected lines
          const linesBeforeCaret = getLines(value, selectionStart);
          const startLine = linesBeforeCaret.length - 1;
          const endLine = getLines(value, selectionEnd).length - 1;
          const startLineText = linesBeforeCaret[startLine];

          applyEdits({
            value: value
              .split('\n')
              .map((line, index) => {
                if (index >= startLine && index <= endLine) {
                  return tabCharacter + line;
                }

                return line;
              })
              .join('\n'),
            // Move the start cursor by number of characters added in first line of selection
            // Don't move it if it there was no text before cursor
            selectionStart:
              startLineText !== undefined && /\S/.test(startLineText)
                ? selectionStart + tabCharacter.length
                : selectionStart,
            // Move the end cursor by total number of characters added
            selectionEnd: selectionEnd + tabCharacter.length * (endLine - startLine + 1),
          });
        } else {
          const updatedSelection = selectionStart + tabCharacter.length;

          applyEdits({
            // Insert tab character at caret
            value:
              value.slice(0, Math.max(0, selectionStart)) +
              tabCharacter +
              value.slice(Math.max(0, selectionEnd)),
            // Update caret position
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        }
      } else if (event.key === 'Backspace') {
        const hasSelection = selectionStart !== selectionEnd;
        const textBeforeCaret = value.slice(0, Math.max(0, selectionStart));

        if (textBeforeCaret.endsWith(tabCharacter) && !hasSelection) {
          // Prevent default delete behavior
          event.preventDefault();

          const updatedSelection = selectionStart - tabCharacter.length;

          applyEdits({
            // Remove tab character at caret
            value:
              value.slice(0, Math.max(0, selectionStart - tabCharacter.length)) +
              value.slice(Math.max(0, selectionEnd)),
            // Update caret position
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        }
      } else if (event.key === 'Enter') {
        // Ignore selections
        if (selectionStart === selectionEnd) {
          // Get the current line
          const [line] = getLines(value, selectionStart).slice(-1);
          const indentation = line?.match(/^\s+/)?.[0] ?? '';

          if (indentation !== '') {
            event.preventDefault();

            // Preserve indentation on inserting a new line
            const indent = `\n${indentation}`;
            const updatedSelection = selectionStart + indent.length;

            applyEdits({
              // Insert indentation character at caret
              value:
                value.slice(0, Math.max(0, selectionStart)) +
                indent +
                value.slice(Math.max(0, selectionEnd)),
              // Update caret position
              selectionStart: updatedSelection,
              selectionEnd: updatedSelection,
            });
          }
        }
      } else if (
        event.keyCode === KEYCODE_PARENS ||
        event.keyCode === KEYCODE_BRACKETS ||
        event.keyCode === KEYCODE_QUOTE ||
        event.keyCode === KEYCODE_BACK_QUOTE
      ) {
        let chars: string[] | undefined;

        if (event.keyCode === KEYCODE_PARENS && event.shiftKey) {
          chars = ['(', ')'];
        } else if (event.keyCode === KEYCODE_BRACKETS) {
          chars = event.shiftKey ? ['{', '}'] : ['[', ']'];
        } else if (event.keyCode === KEYCODE_QUOTE) {
          chars = event.shiftKey ? ['"', '"'] : ["'", "'"];
        } else if (event.keyCode === KEYCODE_BACK_QUOTE && !event.shiftKey) {
          chars = ['`', '`'];
        }

        // If text is selected, wrap them in the characters
        if (selectionStart !== selectionEnd && chars) {
          event.preventDefault();

          applyEdits({
            value:
              value.slice(0, Math.max(0, selectionStart)) +
              chars[0] +
              value.substring(selectionStart, selectionEnd) +
              chars[1] +
              value.slice(Math.max(0, selectionEnd)),
            // Update caret position
            selectionStart,
            selectionEnd: selectionEnd + 2,
          });
        }
      } else if (
        (isMacLike
          ? event.metaKey && event.keyCode === KEYCODE_Z
          : event.ctrlKey && event.keyCode === KEYCODE_Z) &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();

        undoEdit();
      } else if (
        (isMacLike
          ? event.metaKey && event.keyCode === KEYCODE_Z && event.shiftKey
          : isWindows
            ? event.ctrlKey && event.keyCode === KEYCODE_Y
            : event.ctrlKey && event.keyCode === KEYCODE_Z && event.shiftKey) &&
        !event.altKey
      ) {
        event.preventDefault();

        redoEdit();
      } else if (
        event.keyCode === KEYCODE_M &&
        event.ctrlKey &&
        (isMacLike ? event.shiftKey : true)
      ) {
        event.preventDefault();

        // Toggle capturing tab key so users can focus away
        setCapture((previous) => !previous);
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { value, selectionStart, selectionEnd } = event.currentTarget;

      recordChange(
        {
          value,
          selectionStart,
          selectionEnd,
        },
        true,
      );

      onValueChange(value);
    };

    useEffect(() => {
      const input = inputRef.current;
      if (input !== null) {
        // Save current state of the input
        const { value, selectionStart, selectionEnd } = input;
        recordChange({ value, selectionStart, selectionEnd });
      }
    }, [recordChange]);

    useImperativeHandle(ref, () => {
      return {
        get session() {
          return {
            history: historyRef.current,
          };
        },
        set session(session: { history: EditorHistory }) {
          historyRef.current = session.history;
        },
      };
    }, []);

    const [totalLineCount, setTotalLineCount] = useState(0);

    const lineNumbers: React.ReactNode[] = [];

    for (let index = 1; index <= totalLineCount; index++) {
      lineNumbers.push(<div key={index}>{index}</div>);
    }

    useGranularEffect(
      () => {
        setTotalLineCount(Math.ceil((inputRef.current?.scrollHeight ?? 0) / lineHeight));
      },
      [inputRef.current, value],
      [],
    );

    const lineNumberColumnWidth = Math.max(4, totalLineCount.toString().length) * 12 + 4;
    const textFieldXOffset = lineNumberColumnWidth + 8;

    const styleComponent = <style dangerouslySetInnerHTML={{ __html: cssText }} />;

    const injectedHighlighted = {
      dangerouslySetInnerHTML: { __html: `${highlighted}<br />` },
    };

    return (
      <div
        {...rest}
        style={{
          position: 'relative',
          textAlign: 'left',
          boxSizing: 'border-box',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          ...style,
        }}
        className={className}
      >
        <div
          style={
            {
              display: 'flex',
              flexDirection: 'column',
              flexShrink: '0',
              position: 'absolute',
              textAlign: 'right',
              paddingRight: '4px',
              userSelect: 'none',
              top: '0',
              left: '0',
              width: lineNumberColumnWidth,
            } as React.CSSProperties
          }
          aria-hidden="true"
          className="border-r-bsp text-tpd border-r-2"
        >
          {lineNumbers}
        </div>
        <pre
          className={preClassName}
          aria-hidden="true"
          style={
            {
              ...editorStyles,
              position: 'relative',
              pointerEvents: 'none',
              ...contentStyle,
              left: textFieldXOffset,
              width: `calc(100% - ${textFieldXOffset}px)`,
            } as React.CSSProperties
          }
          {...(typeof highlighted === 'string' ? injectedHighlighted : { children: highlighted })}
        />
        <textarea
          ref={(element) => {
            inputRef.current = element;
          }}
          style={{
            ...editorStyles,
            position: 'absolute',
            top: 0,
            height: '100%',
            resize: 'none',
            color: 'inherit',
            overflow: 'hidden',
            MozOsxFontSmoothing: 'grayscale',
            WebkitFontSmoothing: 'antialiased',
            WebkitTextFillColor: 'transparent',
            ...contentStyle,
            left: textFieldXOffset,
            width: `calc(100% - ${textFieldXOffset}px)`,
            ...textareaStyle,
          }}
          className={className}
          id={textareaId}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={onClick}
          onKeyUp={onKeyUp}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          form={form}
          maxLength={maxLength}
          minLength={minLength}
          name={name}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          autoFocus={autoFocus}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellcheck={false}
          data-gramm={false}
        />
        {styleComponent}
      </div>
    );
  },
);

const editorStyles: React.CSSProperties = {
  margin: 0,
  border: 0,
  background: 'none',
  boxSizing: 'inherit',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontStyle: 'inherit',
  fontVariantLigatures: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  lineHeight: `${lineHeight}px`,
  tabSize: 'inherit',
  textIndent: 'inherit',
  textRendering: 'inherit',
  textTransform: 'inherit',
  whiteSpace: 'pre-wrap',
  wordBreak: 'keep-all',
  overflowWrap: 'break-word',
};
