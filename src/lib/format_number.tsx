export function formatNumberAsHexBytes(x: number, minBytes = 0): string {
  const hex = x.toString(16).toUpperCase();
  const byteLength = Math.max(1, minBytes, Math.ceil(Math.log2(x + 1) / 8));

  return hex
    .padStart(byteLength * 2, '0')
    .replace(/../g, '$& ')
    .trim();
}

export function formatHexNumber(x: number, minDigits: number) {
  return x.toString(16).toUpperCase().padStart(minDigits, '0').replace(/../g, '$& ').trim();
}
