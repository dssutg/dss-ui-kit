/**
 * The SVG sanitizer is the security boundary for untrusted SVG a consumer stores or renders, so the
 * suite is the payload corpus the contract is held to rather than a sample of it: each vector a
 * browser would execute, navigate or fetch through is asserted neutralised, and a benign document is
 * asserted to survive byte for byte.
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isSafeSVGString, sanitizeSVGString } from './svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A document every payload is embedded in, so removing one element leaves the rest observable. */
function svg(body: string): string {
  return `<svg xmlns="${SVG_NS}">${body}</svg>`;
}

/** The empty drawing the serializer produces when every child was dropped. */
const EMPTY_SVG = `<svg xmlns="${SVG_NS}"/>`;

/**
 * The payloads that must not survive. Each is paired with the marker that would prove it did, so a
 * failure names the vector rather than only the string.
 */
const payloads: ReadonlyArray<readonly [name: string, payload: string, forbidden: string]> = [
  ['a script element', svg('<script>alert(1)</script><rect/>'), 'script'],
  ['an onload handler', `<svg xmlns="${SVG_NS}" onload="alert(1)"><rect/></svg>`, 'onload'],
  ['an onclick handler', svg('<rect onclick="alert(1)"/>'), 'onclick'],
  ['an onerror handler', svg('<image onerror="alert(1)"/>'), 'onerror'],
  ['a javascript: href', svg('<a href="javascript:alert(1)"><rect/></a>'), 'javascript'],
  [
    'a javascript: xlink:href',
    `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"/></svg>`,
    'javascript',
  ],
  [
    'a foreignObject with HTML',
    svg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject><rect/>'),
    'foreignObject',
  ],
  ['an iframe', svg('<iframe src="https://evil.test"/><rect/>'), 'iframe'],
  ['an object', svg('<object data="https://evil.test"/><rect/>'), 'object'],
  ['an embed', svg('<embed src="https://evil.test"/><rect/>'), 'embed'],
  ['an external use', svg('<use href="https://evil.test/x.svg#a"/><rect/>'), 'evil.test'],
  ['an feImage', svg('<filter><feImage href="https://evil.test/x.png"/></filter>'), 'feImage'],
  ['an external image', svg('<image href="https://evil.test/x.png"/>'), 'evil.test'],
  [
    'a CSS url() and @import',
    svg(
      '<style>@import url(https://evil.test/x.css); .a{background:url(https://evil.test/x)}</style><rect class="a"/>',
    ),
    'evil.test',
  ],
  ['a style attribute url()', svg('<rect style="fill:url(https://evil.test/x)"/>'), 'evil.test'],
  ['a style expression()', svg('<rect style="width:expression(alert(1))"/>'), 'expression'],
  [
    'a javascript: in CSS',
    svg('<style>.a{background:url(javascript:alert(1))}</style>'),
    'javascript',
  ],
  [
    'an animate element',
    svg('<animate attributeName="href" values="javascript:alert(1)"/><rect/>'),
    'animate',
  ],
  ['a data:text/html image', svg('<image href="data:text/html,alert"/>'), 'data:text/html'],
  [
    'a data:image/svg+xml image',
    svg('<image href="data:image/svg+xml;base64,PHN2Zy8+"/>'),
    'svg+xml',
  ],
  [
    'a namespaced scripting attribute',
    svg('<rect xmlns:foo="https://evil.test" foo:onload="alert(1)"/>'),
    'onload',
  ],
  [
    'a foreign-namespace drawing element',
    svg('<foo:rect xmlns:foo="https://evil.test" onload="alert(1)"/>'),
    'foo:rect',
  ],
];

/** A benign document with shapes, a gradient, text and an embedded raster image. */
const BENIGN_SVG =
  `<svg xmlns="${SVG_NS}" viewBox="0 0 10 10"><defs><linearGradient id="g">` +
  '<stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
  '<rect width="10" height="10" fill="url(#g)"/><text x="1" y="1">hi</text></svg>';

describe('sanitizeSVGString', () => {
  test.each(payloads)('removes %s', (_name, payload, forbidden) => {
    const sanitized = sanitizeSVGString(payload);

    expect(sanitized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    expect(sanitizeSVGString(sanitized)).toBe(sanitized);
  });

  test('leaves the empty drawing when every child is removed', () => {
    expect(sanitizeSVGString(svg('<script>alert(1)</script>'))).toBe(EMPTY_SVG);
  });

  test('drops a script but keeps the drawing around it', () => {
    expect(sanitizeSVGString(svg('<script>alert(1)</script><rect/>'))).toBe(
      `<svg xmlns="${SVG_NS}"><rect/></svg>`,
    );
  });

  test('keeps a fragment use and the symbol it names', () => {
    const source = svg('<symbol id="s"><rect/></symbol><use href="#s" x="0"/>');

    expect(sanitizeSVGString(source)).toBe(source);
  });

  test('keeps an embedded raster data: image', () => {
    const source = svg('<image href="data:image/png;base64,iVBORw0KGgo="/>');

    expect(sanitizeSVGString(source)).toBe(source);
  });

  test('removes an imported stylesheet and a remote url but keeps local CSS', () => {
    const sanitized = sanitizeSVGString(
      svg('<style>@import url(https://evil.test/x.css); .a{fill:red}</style><rect class="a"/>'),
    );

    expect(sanitized).not.toContain('@import');
    expect(sanitized).not.toContain('evil.test');
    expect(sanitized).toContain('.a{fill:red}');
  });

  test('removes a comment and a processing instruction', () => {
    const source = `<?xml-stylesheet href="x"?><!-- hidden -->${svg('<rect/>')}`;

    expect(sanitizeSVGString(source)).toBe(`<svg xmlns="${SVG_NS}"><rect/></svg>`);
  });

  test('strips a doctype without entities and keeps the document', () => {
    const source = `<!DOCTYPE svg>${svg('<rect/>')}`;

    expect(sanitizeSVGString(source)).toBe(`<svg xmlns="${SVG_NS}"><rect/></svg>`);
  });

  test('does not expand an entity from a doctype internal subset', () => {
    const source = `<!DOCTYPE svg [<!ENTITY x "EXPANDED">]>${svg('<text>&x;</text>')}`;
    const sanitized = sanitizeSVGString(source);

    expect(sanitized).not.toContain('EXPANDED');
    expect(sanitized).toBe('');
  });

  test('rejects a value holding a control character', () => {
    const payload = svg(`<rect fill="red${String.fromCharCode(0)}"/>`);

    expect(sanitizeSVGString(payload)).toBe('');
  });

  test('returns the empty string for a non-svg root', () => {
    expect(sanitizeSVGString('<html><body>hi</body></html>')).toBe('');
    expect(sanitizeSVGString('not xml at all <<<')).toBe('');
    expect(sanitizeSVGString('')).toBe('');
  });

  test('returns a benign document unchanged', () => {
    expect(sanitizeSVGString(BENIGN_SVG)).toBe(BENIGN_SVG);
  });

  test('is idempotent over every payload and the benign document', () => {
    const corpus = [...payloads.map(([, payload]) => payload), BENIGN_SVG, ''];

    for (const source of corpus) {
      const once = sanitizeSVGString(source);

      expect(sanitizeSVGString(once)).toBe(once);
    }
  });

  test('serialises output that parses back as valid SVG and renders', () => {
    const sanitized = sanitizeSVGString(BENIGN_SVG);
    const parsed = new DOMParser().parseFromString(sanitized, 'image/svg+xml');

    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0);

    const container = document.createElement('div');
    container.innerHTML = sanitized;
    document.body.appendChild(container);

    expect(container.querySelector('rect')).not.toBeNull();
    expect(container.querySelector('text')?.textContent).toBe('hi');
    container.remove();
  });
});

describe('allowExternalReferences', () => {
  const externalReference = `<svg xmlns="${SVG_NS}"><use href="https://example.test/x.svg#a"/><image href="https://example.test/x.png"/></svg>`;

  test('keeps external references when allowed', () => {
    expect(sanitizeSVGString(externalReference, { allowExternalReferences: true })).toBe(
      externalReference,
    );
  });

  test('removes external references by default', () => {
    expect(sanitizeSVGString(externalReference)).not.toContain('example.test');
  });

  test('still drops an active scheme when external references are allowed', () => {
    const payload = svg('<image href="javascript:alert(1)"/>');

    expect(sanitizeSVGString(payload, { allowExternalReferences: true })).not.toContain(
      'javascript',
    );
  });

  test('still drops a data:text/html payload when external references are allowed', () => {
    const payload = svg('<image href="data:text/html,alert"/>');

    expect(sanitizeSVGString(payload, { allowExternalReferences: true })).not.toContain(
      'data:text/html',
    );
  });

  test('still drops a non-raster data: payload when external references are allowed', () => {
    const payload = svg('<image href="data:image/svg+xml;base64,PHN2Zy8+"/>');

    expect(sanitizeSVGString(payload, { allowExternalReferences: true })).not.toContain('svg+xml');
  });
});

describe('isSafeSVGString', () => {
  test('agrees with the sanitizer on a benign document', () => {
    expect(isSafeSVGString(BENIGN_SVG)).toBe(true);
    expect(isSafeSVGString(BENIGN_SVG)).toBe(sanitizeSVGString(BENIGN_SVG) === BENIGN_SVG);
  });

  test('rejects every payload', () => {
    for (const [, payload] of payloads) {
      expect(isSafeSVGString(payload)).toBe(false);
    }
  });

  test('rejects a non-svg root and an empty string', () => {
    expect(isSafeSVGString('<html><body>hi</body></html>')).toBe(false);
    expect(isSafeSVGString('')).toBe(false);
  });

  test('honours the external-reference option', () => {
    const external = svg('<image href="https://example.test/x.png"/>');

    expect(isSafeSVGString(external)).toBe(false);
    expect(isSafeSVGString(external, { allowExternalReferences: true })).toBe(true);
  });
});

/**
 * The parser jsdom never throws from, but that another conforming implementation can: a
 * synchronous failure out of `parseFromString` must leave the caller with the empty string, the
 * same answer a parse error produces.
 */
describe('a DOMParser that fails synchronously', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('yields the empty string through the guard on the parse call', () => {
    vi.stubGlobal(
      'DOMParser',
      class ThrowingParser {
        parseFromString(): Document {
          throw new Error('simulated parser crash');
        }
      },
    );

    expect(sanitizeSVGString(svg('<rect/>'))).toBe('');
  });
});

/**
 * The grammar-level protections the suite asserts through a parser that returns a document the
 * XML grammar should never have produced — a non-spec implementation with `parsererror` handling a
 * browser might disagree with. What is under test is the sanitizer's own defence: a value carrying
 * a control character, or a `url()` nobody local, must not survive wherever it arrived from.
 */
describe('values a laxer parser could deliver', () => {
  /** A parser that returns a fixed document built with the live DOM API. */
  const parserReturning = (source: () => Document): void => {
    vi.stubGlobal(
      'DOMParser',
      class StubParser {
        parseFromString(): Document {
          return source();
        }
      },
    );
  };

  /** An `<svg>` in the drawing namespace holding one `<rect>`. */
  const svgDocument = (): Document => document.implementation.createDocument(SVG_NS, 'svg', null);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('drops an attribute whose value holds a control character', () => {
    parserReturning(() => {
      const doc = svgDocument();
      const rect = doc.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('fill', 'red\u0001');

      doc.documentElement?.appendChild(rect);

      return doc;
    });

    expect(sanitizeSVGString(svg('<rect fill="anything"/>'))).toBe(svg('<rect/>'));
  });

  test('keeps an allowed element of the same document', () => {
    parserReturning(() => {
      const doc = svgDocument();
      const rect = doc.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('width', '10');

      doc.documentElement?.appendChild(rect);

      return doc;
    });

    const sanitized = sanitizeSVGString(svg('<rect/>'));

    expect(sanitized).toContain('<svg');
    expect(sanitized).toContain('<rect');
    expect(sanitized).toContain('width="10"');
  });
});

describe('namespaced attributes the policy keeps in check', () => {
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  test('keeps an xml:space hint and drops the xml attributes it does not keep', () => {
    const source = `<svg xmlns="${SVG_NS}"><rect xml:space="preserve" xml:lang="en"/></svg>`;
    const sanitized = sanitizeSVGString(source);

    expect(sanitized).toContain('xml:space="preserve"');
    expect(sanitized).not.toContain('xml:lang');
  });

  test('keeps xlink:href beside the other xlink attributes on an allowed element', () => {
    const source =
      `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">` +
      '<use xlink:title="ignored" xlink:href="#s"/></svg>';
    const sanitized = sanitizeSVGString(source);

    expect(sanitized).toContain('href="#s"');
    expect(sanitized).toContain(XLINK_NS);
    expect(sanitized).not.toContain('ignored');
  });

  test('drops an external xlink:href on an allowed element', () => {
    const source =
      `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">` +
      '<use xlink:href="https://evil.test/x.svg#a"/></svg>';
    const sanitized = sanitizeSVGString(source);

    expect(sanitized).not.toContain('evil.test');
  });

  test('keeps an external xlink:href only when external references are allowed', () => {
    const source =
      `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}">` +
      '<use xlink:href="https://example.test/x.svg#a"/></svg>';

    expect(sanitizeSVGString(source, { allowExternalReferences: true })).toContain('example.test');
  });

  test('does not deliver the DEL character in an attribute value', () => {
    const payload = svg(`<rect fill="red${String.fromCharCode(127)}"/>`);
    const sanitized = sanitizeSVGString(payload);

    expect(sanitized.toLowerCase()).not.toContain('red');
  });

  test('scrubs a javascript: scheme out of a kept attribute like fill', () => {
    const payload = svg('<rect fill="javascript:alert(1)"/>');
    const sanitized = sanitizeSVGString(payload);

    expect(sanitized).not.toContain('javascript');
    expect(sanitized).toContain('<rect');
  });
});

describe('css scrubbed inside the document', () => {
  test('keeps a local url() reference through a style attribute', () => {
    const source = svg('<rect style="fill:url(#g)"/>');

    expect(sanitizeSVGString(source)).toBe(source);
  });

  test('keeps an embedded raster image through a style attribute', () => {
    const source = svg('<rect style="fill:url(data:image/png;base64,iVBORw0KGgo=)"/>');

    expect(sanitizeSVGString(source)).toBe(source);
  });

  test('keeps a remote url() in CSS only when external references are allowed', () => {
    const source = svg('<style>.a{fill:url(https://example.test/x.css)}</style><rect class="a"/>');

    expect(sanitizeSVGString(source, { allowExternalReferences: true })).toContain('example.test');
    expect(sanitizeSVGString(source)).not.toContain('example.test');
  });

  test('drops a style attribute whose value is a remote url()', () => {
    const source = svg('<rect fill="url(https://evil.test/x)"/>');

    const sanitized = sanitizeSVGString(source);

    expect(sanitized).not.toContain('evil.test');
    expect(sanitized).toContain('<rect');
  });

  test('drops a style element consisting only of a comment', () => {
    const source = svg('<style>/* nothing */</style>');

    expect(sanitizeSVGString(source)).toBe(EMPTY_SVG);
  });

  test('drops a style element whose CSS holds expression()', () => {
    const payload = svg('<style>.a{width:expression(alert(1))}</style>');

    expect(sanitizeSVGString(payload)).toBe(EMPTY_SVG);
  });

  test('treats a url() with an empty target as external and drops the attribute', () => {
    const payload = svg('<rect fill="url()"/>');

    expect(sanitizeSVGString(payload)).toBe(svg('<rect/>'));
  });
});

describe('references the policy admits only partly', () => {
  test('drops a data: payload that is neither raster nor a known-safe document', () => {
    const payload = svg('<image href="data:text/plain,hi"/>');

    expect(sanitizeSVGString(payload)).not.toContain('data:');
  });

  test('keeps a text node inside a CDATA section', () => {
    const source = svg('<text><![CDATA[kept text]]></text>');
    const sanitized = sanitizeSVGString(source);

    expect(sanitized).toContain('<text>');
    expect(sanitized).toContain('kept text');
  });

  test('drops a comment child without dropping its siblings', () => {
    const source = svg('<!-- gone --><rect/>');

    expect(sanitizeSVGString(source)).toBe(`<svg xmlns="${SVG_NS}"><rect/></svg>`);
  });

  test('answers empty for an svg root outside the drawing namespace', () => {
    const payload = '<svg xmlns="http://example.com/ns"><rect/></svg>';

    expect(sanitizeSVGString(payload)).toBe('');
  });

  test('cuts a doctype that never ends', () => {
    expect(sanitizeSVGString('<!DOCTYPE svg')).toBe('');
  });

  test('cuts a doctype whose internal subset carries quoted brackets and angle brackets', () => {
    const source = `<!DOCTYPE svg [<!ENTITY q 'a>b']]>${svg('<rect/>')}`;

    expect(sanitizeSVGString(source)).toBe(`<svg xmlns="${SVG_NS}"><rect/></svg>`);
  });

  test('cuts a doctype the entity subset closes, leaving the document to parse empty with it', () => {
    const source = `<!DOCTYPE svg [<!ENTITY q 'a>b'>]>${svg('<text>&q;</text>')}`;

    expect(sanitizeSVGString(source)).toBe('');
  });
});
