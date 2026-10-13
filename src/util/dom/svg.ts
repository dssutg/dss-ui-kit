/**
 * Sanitizing an SVG string into one that is safe to store or render.
 *
 * An SVG is an XML document, not an image format: inlined into the DOM it runs scripts, fires event
 * handlers and fetches whatever its references name. The sanitizer parses the input as XML into a
 * detached document, rebuilds it against an element allowlist and serializes the result. It is a
 * hand-written allowlist rather than a wrapper around a general-purpose HTML sanitizer: the rules a
 * drawing document needs — keep `<use href="#id">`, strip a remote `href` but not an embedded
 * `data:` image, scrub `url()` out of CSS — are the exceptions around an HTML sanitizer rather than
 * what one does by default, and a dependency carried for its non-default behaviour is the allowlist
 * written twice.
 *
 * Browser-only: it needs `DOMParser`. A consumer that persists SVG sanitizes in the browser before
 * upload; a server that serves it back must render it through an `<img>` or a `data:` URL, where
 * scripts cannot run.
 */

/** The XML namespaces the sanitizer reads or preserves. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/**
 * The drawing subset the sanitizer keeps.
 *
 * Everything not named here is dropped with its subtree, which is what removes `script`,
 * `foreignObject`, `iframe`, `object`, `embed`, `a`, the SMIL animation elements and the `<feImage>`
 * filter primitive — the elements whose whole purpose is to execute, carry foreign markup or fetch a
 * remote resource.
 */
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'image',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
  'clipPath',
  'mask',
  'marker',
  'title',
  'desc',
  'style',
  'filter',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
]);

/**
 * The scheme markers that make a value an active payload.
 *
 * Checked against the value with every character up to and including space removed, so `java\nscript:`
 * and `jav&#x61;script:` (already decoded by the XML parser) read the same as the plain spelling.
 */
const DANGEROUS_SCHEMES: readonly string[] = [
  'javascript:',
  'vbscript:',
  'livescript:',
  'mocha:',
  'data:text/html',
  'data:application/xhtml',
];

/** An embedded raster image. An SVG subtype is excluded: that payload is a document, not a texture. */
const DATA_IMAGE = /^data:image\/(?!svg)[a-z0-9.+-]+(?:[;,]|$)/i;

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_IMPORT = /@import\b[^;]*(?:;|$)/gi;
const CSS_URL = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
const CSS_EXPRESSION = /expression\s*\(/i;

/** The code point of `DEL`, the one non-printing character outside the C0 range. */
const DELETE_CODE_POINT = 0x7f;

/** The highest code point that is whitespace or a C0 control character. */
const SPACE_CODE_POINT = 0x20;

/** The whitespace control characters XML keeps as text rather than rejecting. */
const ALLOWED_CONTROL_CODE_POINTS: ReadonlySet<number> = new Set([0x09, 0x0a, 0x0d]);

/** What sanitizing an SVG string may be told. */
export interface SanitizeSVGOptions {
  /**
   * Keep references to external resources (`<use>`, `<image>`, `url()`). Off: an external reference
   * is a network request the consumer did not ask for. On only when the caller controls where the
   * document is rendered.
   */
  readonly allowExternalReferences?: boolean | undefined;
}

/** The character index just past the `<!DOCTYPE` keyword that starts a document type declaration. */
const DOCTYPE_KEYWORD_LENGTH = '<!doctype'.length;

/** The mutable cursor {@link consumeDoctypeCharacter} carries through a document type declaration. */
interface DoctypeScanState {
  depth: number;
  quote: string;
}

/**
 * Removes a document type declaration, and so any entity definitions it carries.
 *
 * XML parsing expands an internal entity subset, which is the "billion laughs" and XXE primitive, so
 * the declaration is cut from the source before the parser ever sees it. A reference that named a
 * cut entity then parses as an error, which becomes the empty-string answer the sanitizer gives for
 * anything it cannot read. The internal subset is bracketed, and a quoted literal may contain `>` or
 * a bracket, so both are tracked rather than the first `>` being taken.
 */
function stripDoctype(source: string): string {
  const start = source.toLowerCase().indexOf('<!doctype');
  if (start === -1) {
    return source;
  }

  const state: DoctypeScanState = { depth: 0, quote: '' };

  for (let index = start + DOCTYPE_KEYWORD_LENGTH; index < source.length; index += 1) {
    if (consumeDoctypeCharacter(source.charAt(index), state)) {
      return source.slice(0, start) + source.slice(index + 1);
    }
  }

  return source.slice(0, start);
}

/**
 * Advances the cursor one character through a document type declaration.
 *
 * Returns `true` when the declaration's closing `>` has been read. A quote makes `[`, `]` and `>`
 * literal until it closes; a bracket nests the internal subset, inside which the final `>` does not
 * end the declaration.
 */
function consumeDoctypeCharacter(character: string, state: DoctypeScanState): boolean {
  if (state.quote !== '') {
    if (character === state.quote) {
      state.quote = '';
    }

    return false;
  }

  if (character === '"' || character === "'") {
    state.quote = character;
  } else if (character === '[') {
    state.depth += 1;
  } else if (character === ']') {
    state.depth -= 1;
  } else if (character === '>' && state.depth <= 0) {
    return true;
  }

  return false;
}

/** The code point of the first character of `value`, or `0` for the empty string. */
function codePointOf(value: string): number {
  // Both call sites iterate a string, whose loop always yields non-empty characters, so the read
  // never lands on an absent index at runtime; the guarded form is for the compiler, which with
  // `noUncheckedIndexedAccess` cannot see it. The unreached fallback arm stays out of the gate.
  // v8 ignore next
  return value.codePointAt(0) ?? 0;
}

/**
 * Whether `value` holds a control character the XML grammar should never have allowed.
 *
 * Tab, newline and carriage return are the three that are text rather than an error.
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = codePointOf(character);

    if (
      code === DELETE_CODE_POINT ||
      (code < SPACE_CODE_POINT && !ALLOWED_CONTROL_CODE_POINTS.has(code))
    ) {
      return true;
    }
  }

  return false;
}

/** `value` with every character up to and including space, and `DEL`, removed. */
function stripSchemeCharacters(value: string): string {
  let stripped = '';

  for (const character of value) {
    const code = codePointOf(character);

    if (code > SPACE_CODE_POINT && code !== DELETE_CODE_POINT) {
      stripped += character;
    }
  }

  return stripped;
}

/** Whether `value` resolves through a scheme that executes or loads foreign markup. */
function hasDangerousScheme(value: string): boolean {
  const normalized = stripSchemeCharacters(value).toLowerCase();

  return DANGEROUS_SCHEMES.some((scheme) => normalized.includes(scheme));
}

/** Whether `value` is an embedded raster `data:` URL rather than an external resource. */
function isDataImage(value: string): boolean {
  return DATA_IMAGE.test(value.trim());
}

/** Whether a `url()` target stays inside the document or is an embedded raster image. */
function isLocalOrDataURL(value: string): boolean {
  const target = value.trim();

  return target.startsWith('#') || isDataImage(target);
}

/**
 * Whether any `url()` in `value` points outside the document.
 *
 * Presentation attributes such as `fill` and `filter` carry CSS values, so a remote `url()` there is
 * the same fetch as one in a stylesheet.
 */
function hasExternalURL(value: string): boolean {
  for (const match of value.matchAll(CSS_URL)) {
    // The quote group in `CSS_URL` can match the empty string, and a matching-empty group always
    // participates in the match, so `match[2]` is always a string — `undefined` would need a group
    // that the whole match skipped. The unreached fallback arm stays out of the coverage gate.
    // v8 ignore next
    if (!isLocalOrDataURL(match[2] ?? '')) {
      return true;
    }
  }

  return false;
}

/**
 * Scrubs the CSS a `<style>` element or a `style` attribute may carry.
 *
 * `@import` is removed and a remote `url()` is replaced with `none`. A value that holds an executing
 * scheme (`javascript:`, `vbscript:`, a `data:text/html` document) or `expression(` — the old IE
 * script-in-CSS primitive — has no legitimate use here, so it is rejected outright by returning
 * `null`, which drops the attribute or element.
 */
function sanitizeCSS(css: string, options: SanitizeSVGOptions): string | null {
  if (hasControlCharacter(css) || CSS_EXPRESSION.test(css) || hasDangerousScheme(css)) {
    return null;
  }

  const withoutComments = css.replace(CSS_COMMENT, '');
  const withoutImports = withoutComments.replace(CSS_IMPORT, '');

  return withoutImports.replace(CSS_URL, (match, _quote: string, target: string): string => {
    if (isLocalOrDataURL(target) || options.allowExternalReferences === true) {
      return match;
    }

    return 'none';
  });
}

/**
 * Validates an `href`/`xlink:href` value against the reference policy.
 *
 * A fragment (`#id`) and an embedded raster image are always kept. Anything else is an external
 * resource and is dropped unless the caller allowed external references.
 */
function sanitizeReference(value: string, options: SanitizeSVGOptions): string | null {
  const reference = value.trim();

  if (hasControlCharacter(value) || hasDangerousScheme(reference)) {
    return null;
  }

  if (reference.startsWith('#') || isDataImage(reference)) {
    return reference;
  }

  // A `data:` reference is embedded, not external, so allowing external references does not admit
  // one: a raster payload is the only embedded document an image slot may hold.
  if (reference.toLowerCase().startsWith('data:')) {
    return null;
  }

  if (options.allowExternalReferences === true) {
    return reference;
  }

  return null;
}

/** Validates an ordinary attribute value, with the `style` attribute going through CSS scrubbing. */
function sanitizeAttributeValue(
  name: string,
  value: string,
  options: SanitizeSVGOptions,
): string | null {
  if (hasControlCharacter(value) || hasDangerousScheme(value)) {
    return null;
  }

  if (name === 'style') {
    return sanitizeCSS(value, options);
  }

  if (options.allowExternalReferences !== true && hasExternalURL(value)) {
    return null;
  }

  return value;
}

/** Whether an element's name and namespace are in the drawing subset. */
function isAllowedElement(element: Element): boolean {
  if (!ALLOWED_ELEMENTS.has(element.localName)) {
    return false;
  }

  const namespace = element.namespaceURI;

  return namespace === SVG_NAMESPACE || namespace === null || namespace === '';
}

/** Copies an `xlink:href`, the only xlink attribute the sanitizer keeps. */
function copyXLinkAttribute(attribute: Attr, target: Element, options: SanitizeSVGOptions): void {
  if (attribute.localName !== 'href') {
    return;
  }

  const reference = sanitizeReference(attribute.value, options);
  if (reference !== null) {
    target.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', reference);
  }
}

/** Copies an `xml:`-namespaced attribute, keeping only `xml:space`. */
function copyXMLAttribute(attribute: Attr, target: Element): void {
  if (attribute.localName === 'space') {
    target.setAttributeNS(XML_NAMESPACE, 'xml:space', attribute.value);
  }
}

/** Copies an attribute in no namespace, applying the handler, reference and value policies. */
function copyPlainAttribute(attribute: Attr, target: Element, options: SanitizeSVGOptions): void {
  if (attribute.localName.toLowerCase().startsWith('on')) {
    return;
  }

  if (attribute.localName === 'href') {
    const reference = sanitizeReference(attribute.value, options);
    if (reference !== null) {
      target.setAttribute('href', reference);
    }

    return;
  }

  const value = sanitizeAttributeValue(attribute.localName, attribute.value, options);
  if (value !== null) {
    target.setAttribute(attribute.localName, value);
  }
}

/** Copies one attribute onto `target`, dropping it when it fails the policy. */
function copyAttribute(attribute: Attr, target: Element, options: SanitizeSVGOptions): void {
  const namespace = attribute.namespaceURI;

  if (namespace === XMLNS_NAMESPACE) {
    // Namespace declarations are regenerated by the serializer from the names actually used.
    return;
  }

  if (namespace === XLINK_NAMESPACE) {
    copyXLinkAttribute(attribute, target, options);
  } else if (namespace === XML_NAMESPACE) {
    copyXMLAttribute(attribute, target);
  } else if (namespace === null || namespace === '') {
    copyPlainAttribute(attribute, target, options);
  }
}

/** Appends the allowed element children and the text nodes of `source` to `target`. */
function copyChildren(
  source: Element,
  target: Element,
  outDocument: Document,
  options: SanitizeSVGOptions,
): void {
  for (const child of [...source.childNodes]) {
    if (child.nodeType === Node.ELEMENT_NODE && child instanceof Element) {
      const element = copyElement(child, outDocument, options);
      if (element !== null) {
        target.appendChild(element);
      }
    } else if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      // A text node or CDATA section holds its own data as its text content, never `null` — `null`
      // is what a `Document` reports, not what one of these nodes is. The unreached fallback arm
      // stays out of the coverage gate.
      // v8 ignore next
      target.appendChild(outDocument.createTextNode(child.textContent ?? ''));
    }
  }
}

/** Rebuilds a `<style>` element from its scrubbed text, or returns `null` to drop it. */
function copyStyleElement(
  source: Element,
  target: Element,
  options: SanitizeSVGOptions,
): Element | null {
  // An element's text content is the data of its descendant text nodes, an empty string when there
  // are none, and `null` only what a `Document` or a doctype reports: a `<style>` element reports a
  // string. The unreached fallback arm stays out of the coverage gate.
  // v8 ignore next
  const css = sanitizeCSS(source.textContent ?? '', options);

  if (css === null || css.trim() === '') {
    return null;
  }

  target.textContent = css;

  return target;
}

/** Rebuilds one element into `outDocument` against the allowlist, or returns `null` to drop it. */
function copyElement(
  source: Element,
  outDocument: Document,
  options: SanitizeSVGOptions,
): Element | null {
  if (!isAllowedElement(source)) {
    return null;
  }

  const target = outDocument.createElementNS(SVG_NAMESPACE, source.localName);

  for (const attribute of [...source.attributes]) {
    copyAttribute(attribute, target, options);
  }

  if (source.localName === 'style') {
    return copyStyleElement(source, target, options);
  }

  copyChildren(source, target, outDocument, options);

  return target;
}

/** Parses `source` as XML into a detached document, or returns `null` when it does not hold an SVG root. */
function parseSVGDocument(source: string): Document | null {
  let parsed: Document;

  try {
    parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  } catch {
    return null;
  }

  if (parsed.getElementsByTagName('parsererror').length > 0) {
    return null;
  }

  const root = parsed.documentElement;
  if (root.localName !== 'svg') {
    return null;
  }

  return parsed;
}

/**
 * Returns `svg` with every element, attribute and value that can execute code, navigate, or fetch
 * a remote resource removed.
 *
 * The input is parsed as `image/svg+xml` into a detached document, so nothing in it runs or loads
 * while it is being examined. A string whose root element is not `<svg>` sanitizes to the empty
 * string; callers that need to distinguish that case use {@link isSafeSVGString} or check the
 * result. Sanitizing an already-sanitized string returns it unchanged.
 *
 * Browser-only: it needs `DOMParser`. The result is safe wherever it is later rendered, which
 * rendering through an `<img>`/`data:` URL alone cannot promise, because that guarantee lives in the
 * rendering context and a later change to inline rendering removes it.
 */
export function sanitizeSVGString(svg: string, options: SanitizeSVGOptions = {}): string {
  const parsed = parseSVGDocument(stripDoctype(svg));
  if (parsed === null) {
    return '';
  }

  const outDocument = parsed.implementation.createDocument(SVG_NAMESPACE, 'svg', null);
  const root = copyElement(parsed.documentElement, outDocument, options);
  if (root === null) {
    return '';
  }

  outDocument.replaceChild(root, outDocument.documentElement);

  return new XMLSerializer().serializeToString(root);
}

/**
 * Whether `svg` survives {@link sanitizeSVGString} unchanged, and has an `<svg>` root.
 *
 * A convenience for a caller that only needs to accept or reject, not to store a rewritten copy.
 */
export function isSafeSVGString(svg: string, options: SanitizeSVGOptions = {}): boolean {
  const sanitized = sanitizeSVGString(svg, options);

  return sanitized !== '' && sanitized === svg;
}
