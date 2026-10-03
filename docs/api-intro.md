# API reference

This documentation is generated from the source code by
[TypeDoc](https://typedoc.org/), driven by `typedoc.json` and `tsconfig.docs.json`. It is never
edited by hand — regenerate it with:

```bash
deno task docs
```

The output is written to `docs/api/` and is not committed, so the documentation cannot drift from
the code. CI runs the generator and fails if it reports an unresolvable type, so a broken `@link` or a
public signature that names something a consumer cannot import fails the pipeline too.

## What is covered

Exactly what `src/index.ts` exports: the components, the hooks, the infrastructure, and every type one
of their public signatures names. A module that is not reachable from the entry point is not in here,
which is the point of having one public surface — the reference and the package cannot disagree.

Two symbols are deliberately absent: `iconPaths` and `en`, the data `IconName` and `MessageKey` are
derived from. A consumer needs the union of icon names and the set of message keys, not the map of SVG
path data or the English catalogue behind them.

## Conventions

Every exported symbol carries a TSDoc comment. When adding to the public surface:

- Start with a one-line summary, then a blank line and the detail.
- Use `@param` and `@returns` on anything that takes arguments.
- Reference other symbols with `{@link SymbolName}` so TypeDoc can resolve them.
- Say *why* a rule exists when it is not obvious from the code — for example why a missing value is
  never silently defaulted.

The most useful comment in a UI library is the one that says what a component will not do: what it
assumes, what it leaves to the caller, and what it deliberately does not handle. A consumer cannot
find that out by reading the types.

A symbol belongs on the public surface only if something outside its module uses it, and it is
exported by name: `export default` is a lint error everywhere except a root-level `*.config.*`
file. Types are strict — `any` is rejected and `unknown` is narrowed before use — so a signature here
is a contract the compiler enforces, not a comment describing an intention. With
`noUncheckedIndexedAccess`, an index access in a documented signature may be `undefined`; the prose
should say how that absence is handled. See [`AGENTS.md`](../AGENTS.md) for the conventions in full.
