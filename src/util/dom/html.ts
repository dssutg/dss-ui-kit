/**
 * Escapes every character that could start markup in a string.
 *
 * This is entity-encoding as a defence, not an HTML parser: `&`, `<`, `>`, `"` and `'` become
 * entities so a string interpolated into HTML stays text. Untrusted values must pass through
 * here (or {@link escapeHTMLValue}) before they land in markup — which is what the {@link html}
 * template does so a caller cannot forget.
 */
export function sanitizeHTMLString(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts any value to a string safe to interpolate into HTML.
 *
 * The special cases answer real needs rather than uniformity: `null`/`undefined` and an empty
 * array become the empty string because "no value" must not render as the literal text `null`;
 * `false` becomes empty and `true` stays `true` because the values interpolated into markup are
 * mostly attributes, where `false` should mean the attribute is absent rather than the string
 * `"false"`. Objects are JSON-serialised and then run through {@link sanitizeHTMLString}, so a
 * nested `<script>` inside a data object cannot become markup either.
 */
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

/**
 * A tagged template for building HTML strings with escaped interpolations.
 *
 * The static parts of the template are left exactly as written — that is where trusted markup
 * lives — while every interpolation goes through {@link escapeHTMLValue}, so the escaping is the
 * template's decision rather than each call site's: an interpolated value cannot stay raw even by
 * accident. For genuinely raw markup there is no escape hatch by design; build the string from
 * escaped parts with this template or sanitize first with {@link sanitizeHTMLString}.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce((result, stringPart, i) => {
    const value = values[i - 1];
    const safeValue = i > 0 ? escapeHTMLValue(value) : '';
    return result + safeValue + stringPart;
  });
}

/**
 * Wraps a raw HTML string in an inert `<template>` element.
 *
 * Nothing inside a `<template>` runs or renders: scripts do not execute, images do not load and
 * the content is not in the document, so assigning `innerHTML` here is safe where the same string
 * in a live element would both run scripts and fetch subresources. The string therefore arrives
 * from a trusted source — the caller owns it — and the function's job is the deferred cloning
 * lifecycle, not sanitisation; {@link html} and {@link sanitizeHTMLString} are the escaping layer.
 */
export function templ(htmlString: string) {
  const element = document.createElement('template');
  element.innerHTML = htmlString;
  return element;
}
