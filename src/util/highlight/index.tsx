// SPDX-License-Identifier: MIT
// The token lists behind the Lua and JSON syntax highlighting.

const luaTokenPatterns: readonly TokenPattern[] = [
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

const jsonTokenPatterns: readonly TokenPattern[] = [
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

// The comment token of the Lua definition points at this language by name, so the text of a comment
// is tokenized through it: only the marker words the token class names are coloured, and the rest of
// the comment stays plain. It sits in the same map as the public languages but is not part of the
// `Lang` union — a caller colouring a document chooses one of the public ones; the tokenizer walks
// into this one itself.
const todoTokenPatterns: readonly TokenPattern[] = [
  {
    type: 'todo',
    match: /\b(?:TODO|FIXME)\b/g,
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

/** A pattern that matches source text itself, and the class the match is reported with. */
interface MatchedTokenPattern {
  /** The token class the matched text is reported with, when it takes one. */
  readonly type?: string;
  readonly match: RegExp;
  /** The language the matched text is tokenized as once more. */
  readonly sub?: TokenizerLang;
}

/** A pattern that stands in for one of {@link expandData}'s shared patterns, named by its key. */
interface ExpandedTokenPattern {
  readonly match?: never;
  readonly expand: keyof typeof expandData;
}

type TokenPattern = MatchedTokenPattern | ExpandedTokenPattern;

function sanitize(str = '') {
  return str.replace(/[&]/g, '&#38;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toSpan(str: string, type: string | undefined) {
  if (type) {
    return `<span class="shj-syn-${type}">${str}</span>`;
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
  todo: todoTokenPatterns,
};

/** The language entries the walk can reach, including the internal `todo` comment language. */
type TokenizerLang = keyof typeof langTokenMap;

/** What the walk reports one piece of source text with: the class it coloured it as, when it has one.
 *
 * The plain runs between two tokens — and the untouched remainder — are reported with no class.
 */
type TokenSink = (text: string, type: string | undefined) => void;

/** The earliest match one pass over the language found, and where it leaves the reader. */
interface EarliestMatch {
  readonly part: MatchedTokenPattern;
  /** Where the match starts, which is also where the plain text before it ends. */
  readonly index: number;
  /** The text the pattern matched. */
  readonly match: string;
  /** The position the reader continues from once the match has been reported. */
  readonly end: number;
}

/** A pattern's most recent match, kept so the walk does not re-run `exec` over answered text. */
interface CachedMatch {
  readonly match: RegExpExecArray;
  readonly lastIndex: number;
}

/**
 * The pattern's match from `from` onward, out of the cache when the walk still trusts it and through
 * `exec` otherwise — or `undefined` when the pattern is spent and has no match left to give.
 */
function cachedMatchOf(
  part: MatchedTokenPattern,
  src: string,
  from: number,
  cache: Map<MatchedTokenPattern, CachedMatch>,
  spent: Set<MatchedTokenPattern>,
): CachedMatch | undefined {
  if (spent.has(part)) {
    return undefined;
  }

  // Do not call exec again if the previous result is still the answer.
  let cached = cache.get(part);
  if (cached === undefined || cached.match.index < from) {
    part.match.lastIndex = from;
    const match = part.match.exec(src);
    if (match === null) {
      // No more matches with this regex, so the pattern is spent.
      spent.add(part);
      return undefined;
    }
    cached = { match, lastIndex: part.match.lastIndex };
    cache.set(part, cached);
  }

  return cached;
}

/**
 * The earliest match the language's still-live patterns make from `from` onward, or `null`.
 *
 * The patterns are asked last to first and a match at the position already held replaces it, so the
 * earliest definition in the language wins a tie at the same position — which is what lets the Lua
 * comment pattern claim a leading `--` before the operator pattern does.
 */
function earliestMatch(
  src: string,
  from: number,
  patterns: readonly MatchedTokenPattern[],
  cache: Map<MatchedTokenPattern, CachedMatch>,
  spent: Set<MatchedTokenPattern>,
): EarliestMatch | null {
  let first: EarliestMatch | null = null;

  for (const part of patterns) {
    const cached = cachedMatchOf(part, src, from, cache, spent);
    if (cached === undefined) {
      continue;
    }

    // Check if it is the earliest match in the string so far.
    const matchedText = cached.match[0];
    if (matchedText && (first === null || cached.match.index <= first.index)) {
      first = { part, index: cached.match.index, match: matchedText, end: cached.lastIndex };
    }
  }

  return first;
}

/**
 * Walks source text once, reporting every piece of it through `token`.
 *
 * The language's patterns are asked last to first, so the earliest definition in the language wins
 * a tie at the same position. A pattern with a `sub` hands its matched text to the named language,
 * which walks it the same way.
 */
function tokenize(src: string, lang: TokenizerLang, token: TokenSink): void {
  try {
    let i = 0;

    // The patterns are resolved once per walk — a named pattern stands in for the shared one it
    // names — over a reversed copy, so the language definitions are left untouched.
    const patterns: readonly MatchedTokenPattern[] = [...langTokenMap[lang]]
      .map((entry) => ('expand' in entry ? expandData[entry.expand] : entry))
      .reverse();
    const cache = new Map<MatchedTokenPattern, CachedMatch>();
    const spent = new Set<MatchedTokenPattern>();

    while (i < src.length) {
      const first = earliestMatch(src, i, patterns, cache, spent);

      if (first === null) {
        break;
      }

      token(src.slice(i, first.index), undefined);
      i = first.end;

      if (first.part.sub) {
        tokenize(first.match, first.part.sub, token);
      } else {
        token(first.match, first.part.type);
      }
    }

    token(src.slice(i), undefined);
  } catch {
    // With the shipped languages no walk can throw: every `sub` name resolves in `langTokenMap` and
    // every pattern is anchored, so the catch is the resilience arm of a walk the module cannot
    // drive into an error any more. The unreached arm stays out of the coverage gate.
    // v8 ignore next
    token(src, undefined);
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
export function highlightText(src: string, lang: Lang): string {
  let html = '';

  tokenize(src, lang, (text, type) => {
    html += toSpan(sanitize(text), type);
  });

  return html;
}
