import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { EditorHistory } from '@/util/editor/history';
import { useEditorHistory } from '@/util/editor/history';
import { handleEditorKeyDown } from '@/util/editor/keybindings';
import { cssText, editorStyles, lineHeight } from '@/util/editor/style';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/**
 * One value, or one value per edge.
 *
 * What the editor's `padding` prop takes: a single number, or the four edges named individually so a
 * caller can indent the text without indenting the gutter.
 */
export type Padding<T> = T | { top?: T; right?: T; bottom?: T; left?: T };

/**
 * The text editor underneath {@link JsonEditor}: a textarea with a line-number gutter, an undo history
 * and the key handling a code field needs.
 *
 * It is exposed through a ref rather than props because a caller holding code needs to do three things
 * that are not render decisions — read the value, undo, and focus — and each of those is a method on
 * the handle. `ignoreTabKey` exists because Tab is a legitimate character in some documents; the
 * default is the editor taking it to indent, which is what a code field wants and what a form field
 * does not.
 */
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
    const { applyEdits, recordChange, redoEdit, undoEdit } = useEditorHistory({
      historyRef,
      inputRef,
      onValueChange,
    });
    const [capture, setCapture] = useState(true);
    const contentStyle: React.CSSProperties = {
      paddingTop: typeof padding === 'object' ? padding.top : padding,
      paddingRight: typeof padding === 'object' ? padding.right : padding,
      paddingBottom: typeof padding === 'object' ? padding.bottom : padding,
      paddingLeft: typeof padding === 'object' ? padding.left : padding,
    };
    const highlighted = highlight(value);

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

      handleEditorKeyDown(event, {
        applyEdits,
        capture,
        ignoreTabKey,
        insertSpaces,
        redoEdit,
        setCapture,
        tabSize,
        undoEdit,
      });
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

    // biome-ignore lint/style/useNamingConvention: `__html` is the property name React defines on `dangerouslySetInnerHTML`.
    const styleComponent = <style dangerouslySetInnerHTML={{ __html: cssText }} />;

    const injectedHighlighted = {
      // biome-ignore lint/style/useNamingConvention: `__html` is the property name React defines on `dangerouslySetInnerHTML`.
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
