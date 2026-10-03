const luaTokenPatterns = [
  {
    match: /^#!.*|--(\[(=*)\[((?!--]\2])[\s\S])*--]\2]|.*)/g,
    sub: 'todo',
  },
  {
    expand: 'str',
  },
  {
    type: 'kwd',
    match:
      /\b(and|break|do|else|elseif|end|for|function|if|in|local|not|or|repeat|return|then|until|while)\b/g,
  },
  {
    type: 'bool',
    match: /\b(true|false|nil)\b/g,
  },
  {
    type: 'oper',
    match: /[#%*+,./:<=>^~-]+/g,
  },
  {
    expand: 'num',
  },
  {
    type: 'func',
    match: /[A-Z_a-z]+(?=\s*[({])/g,
  },
];

const jsonTokenPatterns = [
  {
    type: 'var',
    match: /("|')?[A-Za-z]\w*\1(?=\s*:)/g,
  },
  {
    expand: 'str',
  },
  {
    expand: 'num',
  },
  {
    type: 'num',
    match: /\bnull\b/g,
  },
  {
    type: 'bool',
    match: /\b(true|false)\b/g,
  },
];

const expandData = {
  num: {
    type: 'num',
    match: /(\.e?|\b)\d(e-|[\d.A-F_a-fox])*(\.|\b)/g,
  },
  str: {
    type: 'str',
    match: /(["'])(\\[\s\S]|(?!\1)[^\n\r\\])*\1?/g,
  },
  strDouble: {
    type: 'str',
    match: /"((?!")[^\n\r\\]|\\[\s\S])*"?/g,
  },
};

function sanitize(str = '') {
  return str.replace(/[&]/g, '&#38;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toSpan(str: string, token: unknown) {
  if (token) {
    return `<span class="shj-syn-${token}">${str}</span>`;
  }
  return str;
}

/**
 * The languages {@link highlightText} can colour.
 *
 * A closed union rather than a name resolved at runtime, so an unsupported language is a compile error
 * instead of uncoloured output.
 */
export type Lang = 'lua' | 'json';

const langTokenMap = {
  lua: luaTokenPatterns,
  json: jsonTokenPatterns,
};

// biome-ignore lint: lint/suspicious/noExplicitAny
function tokenize(src: string | any[], lang: string, token: any) {
  try {
    // biome-ignore lint: lint/suspicious/noExplicitAny
    let m: any;
    // biome-ignore lint: lint/suspicious/noExplicitAny
    let part: any;
    let first = {};
    // biome-ignore lint: lint/suspicious/noExplicitAny
    let match: any;
    const cache = [];
    let i = 0;

    // biome-ignore lint: lint/suspicious/noExplicitAny
    const data: any = typeof lang === 'string' ? langTokenMap[lang as Lang] : lang;

    // Make a fast shallow copy to bee able to splice lang without change the original one
    // biome-ignore lint: lint/suspicious/noExplicitAny
    const arr = [...(typeof lang === 'string' ? data : (lang as any).sub)];

    while (i < src.length) {
      // biome-ignore lint: lint/suspicious/noExplicitAny
      (first as any).index = null;
      m = arr.length;
      while (m-- > 0) {
        // biome-ignore lint: lint/suspicious/noExplicitAny
        part = arr[m].expand ? (expandData as any)[arr[m].expand] : arr[m];
        // Do not call again exec if the previous result is sufficient
        // biome-ignore lint: lint/suspicious/noExplicitAny
        if (cache[m] === undefined || (cache as any)[m].match.index < i) {
          part.match.lastIndex = i;
          match = part.match.exec(src);
          if (match === null) {
            // No more match with this regex can be disposed
            arr.splice(m, 1);
            cache.splice(m, 1);
            continue;
          }
          // Save match for later use to decrease performance cost
          cache[m] = { match, lastIndex: part.match.lastIndex };
        }
        // Check if it the first match in the string
        if (
          // biome-ignore lint: lint/suspicious/noExplicitAny
          (cache as any)[m].match[0] &&
          // biome-ignore lint: lint/suspicious/noExplicitAny
          ((cache as any)[m].match.index <= (first as any).index ||
            // biome-ignore lint: lint/suspicious/noExplicitAny
            (first as any).index === null)
        ) {
          first = {
            part,
            // biome-ignore lint: lint/suspicious/noExplicitAny
            index: (cache as any)[m].match.index,
            // biome-ignore lint: lint/suspicious/noExplicitAny
            match: (cache as any)[m].match[0],
            // biome-ignore lint: lint/suspicious/noExplicitAny
            end: (cache as any)[m].lastIndex,
          };
        }
      }
      // biome-ignore lint: lint/suspicious/noExplicitAny
      if ((first as any).index === null) {
        break;
      }
      // biome-ignore lint: lint/suspicious/noExplicitAny
      token(src.slice(i, (first as any).index), data.type);
      // biome-ignore lint: lint/suspicious/noExplicitAny
      i = (first as any).end;
      // biome-ignore lint: lint/suspicious/noExplicitAny
      if ((first as any).part.sub) {
        tokenize(
          // biome-ignore lint: lint/suspicious/noExplicitAny
          (first as any).match,
          // biome-ignore lint: lint/suspicious/noExplicitAny
          typeof (first as any).part.sub === 'string'
            ? // biome-ignore lint: lint/suspicious/noExplicitAny
              (first as any).part.sub
            : // biome-ignore lint: lint/suspicious/noExplicitAny
              typeof (first as any).part.sub === 'function'
              ? // biome-ignore lint: lint/suspicious/noExplicitAny
                (first as any).part.sub((first as any).match)
              : // biome-ignore lint: lint/suspicious/noExplicitAny
                (first as any).part,
          token,
        );
      } else {
        // biome-ignore lint: lint/suspicious/noExplicitAny
        token((first as any).match, (first as any).part.type);
      }
    }
    token(src.slice(i, src.length), data.type);
  } catch {
    token(src);
  }
}

/**
 * Colours source text as HTML, with one `<span>` per token.
 *
 * Returns a string of HTML rather than a tree of elements because the caller wants to hand it to
 * `innerHTML` or to a document fragment, and the span classes it emits are its own — the caller's
 * stylesheet defines what a token looks like. Every piece of the source is escaped before it is
 * wrapped, so this is safe on text from anywhere.
 */
export function highlightText(src: string | unknown[], lang: Lang) {
  let tmp = '';

  // biome-ignore lint: lint/suspicious/noExplicitAny
  tokenize(src, lang, (str: string | undefined, type: any) => {
    tmp += toSpan(sanitize(str), type);
  });

  return tmp;
}
