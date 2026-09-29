export function serializeDSVColumn(column: string, delimiter: string) {
	let s = "";

	if (delimiter === "\\") {
		throw new Error("Cannot use backslash as delimiter");
	}

	for (const c of column) {
		switch (c) {
			case delimiter:
				s = `${s}\\${delimiter}`;
				break;
			case "\\":
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
	return columns
		.map((column) => serializeDSVColumn(column, delimiter))
		.join(delimiter);
}

export function parseDSV(input: string, delimiter: string) {
	if (delimiter === "\\") {
		throw new Error("Cannot use backslash as delimiter");
	}

	const columns: string[] = [];
	let length = 0;
	let column: string | null = null;

	while (length < input.length) {
		const c = input[length]!;

		if (c === "\\") {
			column = (column ?? "") + (input[length + 1] ?? "");
			length += 2;
		} else if (c === delimiter) {
			columns.push(column ?? "");
			column = "";
			length++;
		} else {
			column = (column ?? "") + c;
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
		.join(",");
}

export function serializeCSV(rows: readonly (readonly string[])[]): string {
	return rows.length > 0
		? `${rows.map((row) => serializeCSVRow(row)).join("\n")}\n`
		: "";
}
// CSV Parser retrieved from Trevor Dixon's answer at
// https://stackoverflow.com/questions/1293147/how-to-parse-csv-data

export function parseCSV(csv: string) {
	const array: string[][] = [];

	// Iterate over each character, keep track of current row and column (of the returned array)
	let insideQuotedField = false;
	let row = 0;
	let column = 0;
	let characterIndex = 0;

	while (characterIndex < csv.length) {
		const currentCharacter = csv[characterIndex];
		const nextCharacter = csv[characterIndex + 1];

		// Create a new row if necessary
		array[row] ??= [];

		// Create a new column (start with empty string) if necessary
		array[row]![column] ??= "";

		// If the current character is a quotation mark, and we're inside a
		// quoted field, and the next character is also a quotation mark,
		// add a quotation mark to the current column and skip the next character
		if (
			currentCharacter === '"' &&
			insideQuotedField &&
			nextCharacter === '"'
		) {
			array[row]![column] += currentCharacter;
			characterIndex += 2;
			continue;
		}

		// If it's just one quotation mark, begin/end quoted field
		if (currentCharacter === '"') {
			insideQuotedField = !insideQuotedField;
			characterIndex++;
			continue;
		}

		// If it's a comma and we're not in a quoted field, move on to the next column
		if (currentCharacter === "," && !insideQuotedField) {
			column++;
			characterIndex++;
			continue;
		}

		// If it's a newline (CRLF) and we're not in a quoted field, skip the next character
		// and move on to the next row and move to column 0 of that new row
		if (
			currentCharacter === "\r" &&
			nextCharacter === "\n" &&
			!insideQuotedField
		) {
			row++;
			column = 0;
			characterIndex += 2;
			continue;
		}

		// If it's a newline (LF or CR) and we're not in a quoted field,
		// move on to the next row and move to column 0 of that new row
		if (currentCharacter === "\n" && !insideQuotedField) {
			row++;
			column = 0;
			characterIndex++;
			continue;
		}
		if (currentCharacter === "\r" && !insideQuotedField) {
			row++;
			column = 0;
			characterIndex++;
			continue;
		}

		// Otherwise, append the current character to the current column
		array[row]![column]! += currentCharacter;
		characterIndex++;
	}

	return array;
}

export function formatObjectToCommaSeparatedString(
	fields: Readonly<Record<string, unknown>>,
) {
	const entries = Object.entries(fields);
	const pairs = entries.map(([field, value]) => `${field}: ${value}`);

	return pairs.join(", ");
}
