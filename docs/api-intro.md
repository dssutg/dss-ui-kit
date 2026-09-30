# API reference

This documentation is generated from the source code by
[TypeDoc](https://typedoc.org/), driven by `typedoc.json` and `tsconfig.docs.json`. It is never
edited by hand — regenerate it with:

```bash
deno task docs
```

The output is written to `docs/api/` and is not committed, so the documentation cannot drift from
the code. CI runs the generator on every merge request and fails if it reports an error, which
means a broken build breaks the documentation build too.

## What is covered

Every module under `src/` and `scripts/` is an entry point — `typedoc.json` expands both globs —
minus the tests and the application files that [`TODO.md`](../TODO.md) stage 10 deletes: `main`,
`prebundle`, `copyright`, `logo`, `routing` and the login-screen overlay.

Once `src/index.ts` exists this stops being a list to keep in step with the tree. The library will
have exactly one public surface, and the reference will document that and nothing else — which is
the point of having one.

## Conventions

Every exported symbol carries a TSDoc comment. When adding to the public surface:

- Start with a one-line summary, then a blank line and the detail.
- Use `@param` and `@returns` on anything that takes arguments.
- Reference other symbols with `{@link SymbolName}` so TypeDoc can resolve them.
- Say *why* a rule exists when it is not obvious from the code — for example why a missing device is
  never downgraded to a fault.

The most useful comment in a UI library is the one that says what a component will not do: what it
assumes, what it leaves to the caller, and what it deliberately does not handle. A consumer cannot
find that out by reading the types.

A symbol belongs on the public surface only if something outside its module uses it, and it is
exported by name: `export default` is a lint error everywhere except a root-level `*.config.*`
file. Types are strict — `any` is rejected and `unknown` is narrowed before use — so a signature here
is a contract the compiler enforces, not a comment describing an intention. With
`noUncheckedIndexedAccess`, an index access in a documented signature may be `undefined`; the prose
should say how that absence is handled. See [`AGENTS.md`](../AGENTS.md) for the conventions in full.
