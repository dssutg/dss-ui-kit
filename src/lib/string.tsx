// This function capitalizes the given string. That means
// it converts the first character of string string uppercase.
// The new string with the changes is returned.
export function capitalize(sequence = '') {
  return sequence.charAt(0).toUpperCase() + sequence.slice(1);
}

// Trim \r or \n from end of line.
// This function is performance-oriented,
// not "clean" code orientied.
export function trimEndNewlines(str: string) {
  let end = str.length;

  while (end > 0) {
    const c = str.charCodeAt(end - 1);
    if (c !== 10 && c !== 13) {
      // \n = 10, \r = 13
      break;
    }
    end--;
  }

  // If nothing changed, return the original string reference
  return end === str.length ? str : str.slice(0, end);
}
