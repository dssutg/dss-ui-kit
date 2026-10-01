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

export function serializeDSV(columns: readonly string[], delimiter: string) {
  return columns.map((column) => serializeDSVColumn(column, delimiter)).join(delimiter);
}

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

export function serializeCSVRow(columns: readonly string[]): string {
  return columns
    .map((column) => {
      const col = column.toString();

      return /[\n\r",]/.test(col) ? `"${col.replace(/"/g, '""')}"` : col;
    })
    .join(',');
}

export function serializeCSV(rows: readonly (readonly string[])[]): string {
  return rows.length > 0 ? `${rows.map((row) => serializeCSVRow(row)).join('\n')}\n` : '';
}
// CSV Parser retrieved from Trevor Dixon's answer at
// https://stackoverflow.com/questions/1293147/how-to-parse-csv-data

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

    // A doubled quotation mark inside a quoted field is one literal quotation mark, and the pair is
    // consumed together so the second half is not mistaken for the end of the field.
    if (currentCharacter === '"' && insideQuotedField && nextCharacter === '"') {
      field += currentCharacter;
      characterIndex += 2;
      continue;
    }

    // A single quotation mark opens or closes a quoted field. Anything inside one is literal, which
    // is what lets a field contain the delimiter, a newline, or a quotation mark of its own.
    if (currentCharacter === '"') {
      insideQuotedField = !insideQuotedField;
      characterIndex++;
      continue;
    }

    if (currentCharacter === ',' && !insideQuotedField) {
      endField();
      characterIndex++;
      continue;
    }

    // A line ending ends the row. A CRLF pair is one ending, not two, so the LF is consumed with
    // the CR rather than starting an empty row of its own.
    if (!insideQuotedField && (currentCharacter === '\r' || currentCharacter === '\n')) {
      endRow();
      characterIndex += currentCharacter === '\r' && nextCharacter === '\n' ? 2 : 1;
      continue;
    }

    field += currentCharacter;
    characterIndex++;
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

export function formatObjectToCommaSeparatedString(fields: Readonly<Record<string, unknown>>) {
  const entries = Object.entries(fields);
  const pairs = entries.map(([field, value]) => `${field}: ${value}`);

  return pairs.join(', ');
}
