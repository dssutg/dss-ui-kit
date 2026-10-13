/**
 * `highlightText` colours Lua and JSON source as HTML with one `<span>` per token, and escapes
 * everything it emits: the output is meant for `innerHTML`, so a test pins both the span shape and
 * the escaping. The tokenizer walks the token lists of the two shipped languages, and the suite
 * holds the observable pieces of that walk — token classes, plain text between tokens, and the
 * catch-all that degrades to raw escaped text.
 */
import { describe, expect, test } from 'vitest';
import { highlightText } from './';

describe('highlightText: json', () => {
  test('wraps keys, strings, numbers and literals in their token spans', () => {
    const html = highlightText('{ "alpha": 12, "beta": true, "gamma": null }', 'json');

    expect(html).toContain('<span class="shj-syn-var">"alpha"</span>');
    expect(html).toContain('<span class="shj-syn-num">12</span>');
    expect(html).toContain('<span class="shj-syn-bool">true</span>');
    expect(html).toContain('<span class="shj-syn-num">null</span>');
  });

  test('emits the text between tokens unspanned and in source order', () => {
    const html = highlightText('{ "alpha": 12 }', 'json');

    expect(html).toBe(
      '{ <span class="shj-syn-var">"alpha"</span>: <span class="shj-syn-num">12</span> }',
    );
  });

  test('colours a bare identifier before a colon as a key', () => {
    const html = highlightText('{ alpha: 1 }', 'json');

    expect(html).toContain('<span class="shj-syn-var">alpha</span>');
  });

  test('escapes markup characters inside string tokens', () => {
    const html = highlightText('"a&b<c>d"', 'json');

    // The escape set is & < > — quotes are left as written, since they delimit the token itself.
    expect(html).toBe('<span class="shj-syn-str">"a&#38;b&lt;c&gt;d"</span>');
  });

  test('leaves text with no tokens as plain escaped text', () => {
    expect(highlightText('just words', 'json')).toBe('just words');
  });

  test('answers an empty string for empty input', () => {
    expect(highlightText('', 'json')).toBe('');
  });
});

describe('highlightText: lua', () => {
  test('wraps keywords, operators and numbers in their token spans', () => {
    const html = highlightText('local x = 1', 'lua');

    expect(html).toBe(
      '<span class="shj-syn-kwd">local</span> x <span class="shj-syn-oper">=</span> <span class="shj-syn-num">1</span>',
    );
  });

  test('wraps an identifier before a call in a function span', () => {
    const html = highlightText('printf(1)', 'lua');

    expect(html).toContain('<span class="shj-syn-func">printf</span>');
    expect(html).toContain('<span class="shj-syn-num">1</span>');
  });

  test('emits a comment as plain unstyled text', () => {
    // The comment pattern carries a `sub: 'todo'`, and no `todo` language is registered, so the
    // tokenizer falls into its catch-all and the comment comes out raw rather than crashing a
    // render that asked for a clock, not a syntax highlighter.
    const html = highlightText('local x = 1 -- a note', 'lua');

    expect(html).toBe(
      '<span class="shj-syn-kwd">local</span> x <span class="shj-syn-oper">=</span> <span class="shj-syn-num">1</span> -- a note',
    );
    expect(html).not.toContain('shj-syn-todo');
  });

  test('escapes markup characters in plain text and comments', () => {
    expect(highlightText('-- a < b & c > d', 'lua')).toBe('-- a &lt; b &#38; c &gt; d');
  });
});
