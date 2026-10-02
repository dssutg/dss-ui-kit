export function sanitizeHTMLString(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeHTMLValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    if (value) {
      return 'true';
    }
    return '';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value) && value.length === 0) {
      return '';
    }
    return sanitizeHTMLString(JSON.stringify(value));
  }
  return sanitizeHTMLString(value.toString());
}

export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce((result, stringPart, i) => {
    const value = values[i - 1];
    const safeValue = i > 0 ? escapeHTMLValue(value) : '';
    return result + safeValue + stringPart;
  });
}

export function templ(htmlString: string) {
  const element = document.createElement('template');
  element.innerHTML = htmlString;
  return element;
}
