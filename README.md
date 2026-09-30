# DSS UI Kit

A domain-independent component library and design system extracted from the original application.

It is the presentational layer of that application — components, the hooks they need, and the styling
contract that makes them look the same everywhere — with the application, the protocol and the domain
model left behind. See [Status](#status) for how far along that is.

## Install

```sh
deno add npm:dss-ui-kit
```

Preact is a peer dependency, so the library runs on the Preact your application already has:

```sh
deno add npm:preact
```

There is no npm or yarn step. This package is built and published with Deno and Vite.

## Use

The public surface is the package root, and every export is named:

```tsx
import { Button, Icon, FilterableTable } from 'dss-ui-kit';
import 'dss-ui-kit/style.css';
```

Nothing is imported by path. A module that is not reachable from the root export is not part of the
library, and adding to it is a deliberate decision about what the library promises.

## Styling

The design system is **119 CSS custom properties** named `--color-*`, defined per theme, and exposed as
Tailwind colour utilities — `bg-bda`, `text-bdat`, `border-tpl`, `fill-tok`. A theme is data, not a
build artefact: switching theme sets a `data-theme` attribute on `<body>` and nothing recompiles.

Both the theme files and the Tailwind colour config ship with the package. A consumer's
`tailwind.config.ts` has to do two things for the components to look right: scan the published
package so Tailwind can see the class names the components render, and declare the same colour map,
because a utility only exists in the output if the config names the token.

```ts
// tailwind.config.ts in the consuming application
import forms from '@tailwindcss/forms';
import type { Config } from 'tailwindcss';

export default {
  // The package is scanned as well as the application, or a class the library renders is
  // never generated and the component is unstyled.
  content: ['./src/**/*.{ts,tsx}', './node_modules/dss-ui-kit/dist/**/*.{js,cjs}'],
  plugins: [forms],
  theme: {
    extend: {
      colors: {
        // The 119 tokens from the library's tailwind.config.ts, named to match the
        // custom properties: { bda: 'var(--color-bda)' }.
      },
    },
  },
} satisfies Config;
```

The library's own `tailwind.config.ts` is the source of truth for that map. Sharing it as an importable
preset rather than a copy is part of the consumption stage, not something this repository does yet.

Renaming a custom property is a breaking change. Adding one is not.

## Localisation

The interface ships in English and Russian, both complete. A message missing from `ru.ts` is a type
error rather than a blank label on a panel an operator is reading, and every string a component
renders comes from a locale file rather than a literal.

## Development

Deno 2 drives everything; there is no npm or yarn step.

```sh
deno install        # install or refresh dependencies
deno task dev       # dev server on http://127.0.0.1:5173
deno task build     # production build into dist/
deno task lint      # biome ci + typecheck
deno task format    # biome check --write
deno task test      # unit tests
deno task docs      # TypeDoc API reference into docs/api/
deno task ci        # the full local gate, exactly what CI runs
```

`deno task ci` is the gate: a green pipeline and a green `deno task ci` mean the same thing.

The rules the code is held to — layering, the `@` import alias, the naming conventions, the
no-`any` and no-non-null-assertion bans — are in [`AGENTS.md`](./AGENTS.md). The plan that takes the
library from the copied file set to a published package, and what each stage still owes, is in
[`TODO.md`](./TODO.md).

## Status

**The library is mid-decoupling, and the copy in `src/` is not yet the published package.**

`src/` began as a file-level copy of the original application: 261 files of application code that still
references an application-only type module, a WebSocket layer and a routing table. The work is to
separate the reusable library from that application. Thirteen stages are planned; the toolchain and
the repository constitution are in place and the separation has not started.

What that means for anyone reading this repository today:

- `src/` is the source of the work, not a working package. It does not compile: 22 import specifiers
  resolve to modules that were never copied. `deno task typecheck` and `deno task build` are red
  because of that, not because of the configuration.
- `src/index.ts`, the entry point Vite builds, arrives with the module-boundary stage. Until then
  there is no package to build.
- `deno task lint` reports the copied code's own debt — 670 errors and 24 warnings, mostly
  non-null assertions and unformatted files. Both are addressed by the house-style stage, in its own
  commit so the reformat diff stays readable.

Only the domain-independent library is intended to be published. application-specific components, the domain
types, the event map and the data layer are removed or genericised on the way, and the manifest's
`files` list keeps them out of the tarball until then. A consumer should treat this as a repository
under active development, not a stable dependency.

## Licence

MIT — see [`LICENSE`](./LICENSE).
