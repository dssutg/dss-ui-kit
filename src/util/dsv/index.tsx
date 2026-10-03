/**
 * One column written with a chosen delimiter, escaping the delimiter and the backslash itself.
 *
 * The escape is a leading backslash, which is why a backslash delimiter is rejected: `parseDSV` could
 * never tell an escaped delimiter from one that splits fields.
 */
export function serializeDSVColumn(column: string, delimiter: string) {
  let s = '';

  if (delimiter === '\\') {
    throw new Error('Cannot use backslash as delimiter');
  }

  for (const c of column) {
    switch (c) {
      case delimiter:
        s = `${s}\\${delimiter}`;
        break;
      case '\\':
        s = `${s}\\\\`;
        break;
      default:
        s += c;
        break;
    }
  }

  return s;
}

/**
 * One row written with a chosen delimiter, quoting whatever the delimiter or a quote would
 * otherwise break.
 *
 * The delimiter is an argument rather than a constant because the same rows are written as CSV for an
 * export and as TSV for a paste into a spreadsheet, and the two differ only here.
 */
export function serializeDSV(columns: readonly string[], delimiter: string) {
  return columns.map((column) => serializeDSVColumn(column, delimiter)).join(delimiter);
}

/**
 * Reads one row written by {@link serializeDSV}, honouring quoted fields that hold the delimiter.
 *
 * One row, not a document: this is what a caller parses a single line with, and a backslash delimiter
 * is rejected outright because the grammar cannot quote it.
 */
export function parseDSV(input: string, delimiter: string) {
  if (delimiter === '\\') {
    throw new Error('Cannot use backslash as delimiter');
  }

  const columns: string[] = [];
  let length = 0;
  let column: string | null = null;

  while (length < input.length) {
    const c = input.charAt(length);

    if (c === '\\') {
      column = (column ?? '') + (input[length + 1] ?? '');
      length += 2;
    } else if (c === delimiter) {
      columns.push(column ?? '');
      column = '';
      length++;
    } else {
      column = (column ?? '') + c;
      length++;
    }
  }

  if (column !== null) {
    columns.push(column);
  }

  return { columns, length };
}

/** One row as a CSV line, without the line ending. Quotes any field holding a comma, quote or newline. */
export function serializeCSVRow(columns: readonly string[]): string {
  return columns
    .map((column) => {
      const col = column.toString();

      return /[\n\r",]/.test(col) ? `"${col.replace(/"/g, '""')}"` : col;
    })
    .join(',');
}

/**
 * A whole table as a CSV document, with a trailing newline.
 *
 * No header handling and no escaping of the caller's data beyond the field rules: what a column title
 * is, and whether rows are quoted or not, are not decided here. An empty table serialises to an empty
 * string rather than to a lone newline.
 */
export function serializeCSV(rows: readonly (readonly string[])[]): string {
  return rows.length > 0 ? `${rows.map((row) => serializeCSVRow(row)).join('\n')}\n` : '';
}
// CSV Parser retrieved from Trevor Dixon's answer at
// https://stackoverflow.com/questions/1293147/how-to-parse-csv-data

/** What a character read at a position in the input means to the CSV grammar. */
type CsvCharacterRole = 'escapedQuote' | 'quote' | 'delimiter' | 'lineEnding' | 'literal';

/**
 * What the character at a position means, given whether a quoted field is open.
 *
 * The order of the tests is the grammar's: an escaped quotation mark is read before a quotation
 * mark, because inside a quoted field the pair is one literal character and the second half must not
 * be taken for the end of the field. A delimiter and a line ending end a field only outside one,
 * which is what lets a quoted field hold either.
 */
function classifyCsvCharacter(
  current: string,
  next: string,
  insideQuotedField: boolean,
): CsvCharacterRole {
  if (current === '"' && insideQuotedField && next === '"') {
    return 'escapedQuote';
  }

  if (current === '"') {
    return 'quote';
  }

  if (insideQuotedField) {
    return 'literal';
  }

  if (current === ',') {
    return 'delimiter';
  }

  if (current === '\r' || current === '\n') {
    return 'lineEnding';
  }

  return 'literal';
}

/** Whether the two characters read together are one CRLF line ending rather than two endings. */
function isCarriageReturnLineFeed(current: string, next: string): boolean {
  return current === '\r' && next === '\n';
}

/**
 * Reads a CSV document into rows of fields, as a spreadsheet writes it.
 *
 * Quoted fields are honoured, including quotes doubled inside them, embedded commas, embedded line
 * endings, and CRLF line endings. A row with a trailing delimiter keeps its last field as an empty
 * string, because that is a cell the file says exists.
 */
export function parseCSV(csv: string) {
  const rows: string[][] = [];

  let insideQuotedField = false;
  let row: string[] = [];
  let field = '';
  let characterIndex = 0;

  // Whether any character has been read in the current cell and in the current row. A delimiter
  // read as the very last character leaves a cell that no character was ever read in, and such a
  // cell is not a field: `a,b,` is three fields but `a,` is two. Tracking it is what keeps that
  // distinction without indexing a row that may not exist yet.
  let cellStarted = false;
  let rowStarted = false;

  /** Commits the field being read to the row being built, and starts the next field. */
  function endField() {
    row.push(field);
    field = '';
    cellStarted = false;
  }

  /** Commits the row being built to the result, and starts the next row. */
  function endRow() {
    endField();
    rows.push(row);
    row = [];
    rowStarted = false;
  }

  while (characterIndex < csv.length) {
    const currentCharacter = csv[characterIndex] ?? '';
    const nextCharacter = csv[characterIndex + 1] ?? '';

    cellStarted = true;
    rowStarted = true;

    switch (classifyCsvCharacter(currentCharacter, nextCharacter, insideQuotedField)) {
      case 'escapedQuote':
        field += currentCharacter;
        characterIndex += 2;
        break;
      case 'quote':
        insideQuotedField = !insideQuotedField;
        characterIndex++;
        break;
      case 'delimiter':
        endField();
        characterIndex++;
        break;
      case 'lineEnding':
        endRow();
        // A CRLF pair is one ending, not two, so the LF is consumed with the CR rather than
        // starting an empty row of its own.
        characterIndex += isCarriageReturnLineFeed(currentCharacter, nextCharacter) ? 2 : 1;
        break;
      case 'literal':
        field += currentCharacter;
        characterIndex++;
        break;
    }
  }

  // Input that does not end in a delimiter or a line ending still has a cell and a row to commit.
  // Input that does end in one does not: the delimiter already committed the field before it, and
  // the cell it opened holds no character, so committing again would add a field that is not there.
  if (cellStarted) {
    endField();
  }

  if (rowStarted) {
    rows.push(row);
  }

  return rows;
}

/**
 * A record rendered as `field: value` pairs joined by commas.
 *
 * For a one-line note in a panel or a log, not a serialisation format: the values go through their
 * `toString`, so an object-shaped value reads as `[object Object]` rather than as its contents.
 */
export function formatObjectToCommaSeparatedString(fields: Readonly<Record<string, unknown>>) {
  const entries = Object.entries(fields);
  const pairs = entries.map(([field, value]) => `${field}: ${value}`);

  return pairs.join(', ');
}
