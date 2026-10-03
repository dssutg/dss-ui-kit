import { describe, expect, it } from 'vitest';
import {
  formatObjectToCommaSeparatedString,
  parseCSV,
  parseDSV,
  serializeCSV,
  serializeCSVRow,
  serializeDSV,
  serializeDSVColumn,
} from './';

/**
 * These are the functions a consumer reaches for when it exports a table or reads a configuration
 * file, so the tests are written as round trips plus the awkward inputs rather than one case per
 * branch: the point is that a value survives the trip, not that a line of code was executed.
 */

describe('serializeCSVRow', () => {
  it('joins plain fields with a comma', () => {
    expect(serializeCSVRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('quotes a field containing the delimiter, a quote, or a newline', () => {
    expect(serializeCSVRow(['a,b'])).toBe('"a,b"');
    expect(serializeCSVRow(['say "hi"'])).toBe('"say ""hi"""');
    expect(serializeCSVRow(['two\nlines'])).toBe('"two\nlines"');
    expect(serializeCSVRow(['carriage\rreturn'])).toBe('"carriage\rreturn"');
  });

  it('leaves a field alone when it needs no quoting', () => {
    expect(serializeCSVRow(['plain', ''])).toBe('plain,');
  });
});

describe('serializeCSV', () => {
  it('ends every row with a newline', () => {
    expect(
      serializeCSV([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\nc,d\n');
  });

  it('produces nothing for no rows', () => {
    expect(serializeCSV([])).toBe('');
  });
});

describe('parseCSV', () => {
  it('splits rows and fields', () => {
    expect(parseCSV('a,b,c\nd,e,f\n')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('keeps a final row that has no trailing newline', () => {
    expect(parseCSV('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('does not invent a row after a trailing newline', () => {
    expect(parseCSV('a\n')).toEqual([['a']]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('treats a blank line as a row holding one empty field', () => {
    expect(parseCSV('a\n\nb\n')).toEqual([['a'], [''], ['b']]);
  });

  it('reads a CRLF pair as one line ending', () => {
    expect(parseCSV('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('reads a lone CR as a line ending too', () => {
    expect(parseCSV('a\rb\r')).toEqual([['a'], ['b']]);
  });

  it('keeps a delimiter inside a quoted field', () => {
    expect(parseCSV('"a,b",c')).toEqual([['a,b', 'c']]);
  });

  it('reads a doubled quote as one literal quote', () => {
    expect(parseCSV('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(parseCSV('"two\nlines",b')).toEqual([['two\nlines', 'b']]);
  });

  it('keeps a CRLF inside a quoted field', () => {
    expect(parseCSV('"two\r\nlines",b')).toEqual([['two\r\nlines', 'b']]);
  });

  it('does not invent a field for a delimiter at the very end of the input', () => {
    // `a,b,` is two fields and `a,` is one, because a delimiter read as the last character opens a
    // field that no character was ever read in, so there is nothing in it to report. A line ending
    // after the delimiter is a character in that field, which is why the same input with a trailing
    // newline does report it.
    expect(parseCSV('a,b,')).toEqual([['a', 'b']]);
    expect(parseCSV('a,')).toEqual([['a']]);
    expect(parseCSV('a,\n')).toEqual([['a', '']]);
  });

  it('round trips every awkward field', () => {
    const rows = [
      ['plain', 'with,comma', 'with"quote', 'with\nnewline', ''],
      ['  leading space kept  ', 'trailing space kept  ', '"', ',', '\r\n'],
    ];

    expect(parseCSV(serializeCSV(rows))).toEqual(rows);
  });
});

describe('serializeDSVColumn', () => {
  it('escapes the delimiter', () => {
    expect(serializeDSVColumn('a,b', ',')).toBe('a\\,b');
  });

  it('escapes a backslash', () => {
    expect(serializeDSVColumn('a\\b', ',')).toBe('a\\\\b');
  });

  it('refuses a backslash delimiter, which could not be escaped', () => {
    expect(() => serializeDSVColumn('a', '\\')).toThrow('Cannot use backslash as delimiter');
  });
});

describe('parseDSV', () => {
  it('splits on the delimiter', () => {
    expect(parseDSV('a,b,c', ',').columns).toEqual(['a', 'b', 'c']);
  });

  it('unescapes an escaped delimiter', () => {
    expect(parseDSV('a\\,b,c', ',').columns).toEqual(['a,b', 'c']);
  });

  it('reads an escape at the end of the input as an empty field', () => {
    expect(parseDSV('a\\', ',').columns).toEqual(['a']);
  });

  it('refuses a backslash delimiter, which could not be escaped', () => {
    expect(() => parseDSV('a', '\\')).toThrow('Cannot use backslash as delimiter');
  });

  it('round trips through serialize', () => {
    const columns = ['plain', 'with,comma', 'with\\backslash'];

    expect(parseDSV(serializeDSV(columns, ','), ',').columns).toEqual(columns);
  });
});

describe('formatObjectToCommaSeparatedString', () => {
  it('formats each field as name and value', () => {
    expect(formatObjectToCommaSeparatedString({ a: 1, b: 'two' })).toBe('a: 1, b: two');
  });

  it('formats an object with no fields as an empty string', () => {
    expect(formatObjectToCommaSeparatedString({})).toBe('');
  });
});
