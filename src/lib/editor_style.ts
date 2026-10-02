import type { CSSProperties } from 'react';

const className = 'npm__react-simple-code-editor__textarea';

export const cssText = `
/**
 * Reset the text fill color so that placeholder is visible
 */
.${className}:empty {
  -webkit-text-fill-color: inherit !important;
}
`;

export const lineHeight = 20;

/**
 * The inline styles shared by the highlighted `<pre>` and by the textarea drawn over it.
 *
 * The two have to lay their text out in exactly the same way: the highlighted copy is invisible and
 * the textarea's own text is transparent, so any difference in font, wrapping or padding shows up
 * as a caret that drifts away from the text under it.
 */
export const editorStyles: CSSProperties = {
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
