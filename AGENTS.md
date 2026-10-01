# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## Repository state

**The library is mid-decoupling.** `src/` is a file-level copy of the original application —
261 files, 35 490 lines of TypeScript and 5 455 of CSS — that has not been adapted to anything. It
does not compile: 22 import specifiers resolve to modules that were never copied.
[`TODO.md`](./TODO.md) holds the plan that takes it to a published package, and the stage each piece
of work belongs to.

Read this document for the rules the finished library is held to, and `TODO.md` for what is still to
be done and in what order. They are not the same thing: a rule here is why the work is done a
particular way, a stage there is what is done next.

**This document describes the target, not the current tree.** A tool, a test or an entry point it
names may not exist yet — `src/index.ts` arrives in stage 5, the per-component tests in stage 11,
and most of the commands do not pass until the stages that fix what they report. The toolchain
itself landed in stage 2, so the commands listed below run, but several of them are red on purpose
until the copy is decoupled. Each stage is named in [`TODO.md`](./TODO.md) with the work that brings
it in, so a rule can be written down before the code that satisfies it lands. What is true *today*
of `src/` is described in the table in
[`TODO.md`](./TODO.md#what-was-copied-and-what-it-means-for-the-stages).

## Project

**DSS UI Kit** — the UI library extracted from the original application so that
the consuming application can consume it as a dependency. It is a component
library and a design system: presentational components, the hooks they need, and the styling
contract that makes them look the same in every application.

What it **is not** matters as much, because it is what was copied out:

- **Not an application.** There is no entrypoint, no page, no router, no shell. `main.tsx`,
  `index.html` and `prebundle.tsx` in the copy are the original application's and are removed in
  [`TODO.md`](./TODO.md) stage 10. A library has no entrypoint; the consumer's `main.tsx` is the
  consumer's.
- **Not a domain model.** There is no BCP, no sensor, no zone, no configuration schema. The original application
  types live in `def.tsx` in the original application, a 3 947-line module this library must not depend on.
- **Not a data layer.** No WebSocket client, no protocol, no persistence. A component takes props.
- **Not a localisation catalogue.** It ships the keys its own components render and no others; the
  consumer adds its own.

The library is consumed by more than one application, which is the constraint every rule below
follows from. Code that is convenient inside the original application and unreachable from a package is not code this
library may keep.

## Toolchain

Inherited from the consuming application so that both repositories are worked on the same way. The
configuration lands in [`TODO.md`](./TODO.md) stage 2; until then the commands below do not run.

| Concern          | Tool                                 | Command                    |
| ---------------- | ------------------------------------ | -------------------------- |
| Build / dev      | Vite 8                               | `deno task dev`            |
| Styling          | Tailwind CSS 3                       | automatic via PostCSS      |
| UI runtime       | Preact via the React compat layer    | —                          |
| Lint + format    | Biome 2 (`biome ci` in `lint`)       | `deno task lint`           |
| Format (write)   | Biome 2                              | `deno task format`         |
| Type check       | tsgo (`@typescript/native-preview`) | `deno task typecheck`      |
| Tests            | Vitest                               | `deno task test`           |
| API docs         | TypeDoc 0.28                         | `deno task docs`           |
| Release          | `scripts/release.ts`                 | `deno task release`        |

Everything runs through **Deno 2** — there is no npm/yarn/pnpm step, and Deno resolves
`package.json` dependencies into `node_modules`. The the original application build this code came from was
esbuild driven by Go scripts, with Preact vendored; none of that carries over.

Biome is the **only** formatter and linter. Deno's `deno fmt` / `deno lint` are disabled in
`deno.json` — do not run them, and do not reformat files to satisfy them.

## Code style

Fixed by `biome.json`. Do not hand-maintain any of it; the formatter owns it.

Four rules are turned off or narrowed for this code base, each with its reason recorded in
[`TODO.md`](./TODO.md#what-the-inherited-rules-found): `noSvgWithoutTitle` for the generated path
data under `src/ui/icons/`, `noDefaultExport` for `*.d.ts`, `noRestrictedImports` narrowed to
`../**`, and `useComponentExportOnlyModules` off because a library with no dev entry point has no
Fast Refresh to protect. A rule that turns out not to fit is a decision to record, not one to make
silently.

- **Semicolons: always.** Every JavaScript and TypeScript statement ends with `;`.
- **Indentation: 2 spaces**, never tabs. Enforced in `biome.json` and `.editorconfig`.
- **Line width 100**, LF endings, final newline.
- Single quotes for JavaScript/TypeScript strings, double quotes in JSX attributes, trailing commas
  everywhere, no bracket spacing in object literals.
- No `any`, no non-null assertions in library code, `import type` for type-only imports.

The copy arrives in tabs and double quotes, formatted by a Biome with no formatter settings at all.
Reformatting it is [`TODO.md`](./TODO.md) stage 3, in its own commit, so the diff that remains
afterwards is a diff about behaviour.

### No bare JavaScript

**Everything this project owns is TypeScript.** No `.js`, `.jsx`, `.mjs` or `.cjs` file is allowed
anywhere in the repository. Dependencies are JavaScript and that is fine — the rule is about what we
write.

A JavaScript file arrives with none of the checking the rest of the codebase is held to, and it is
the easiest thing in the world to add by accident. `scripts/no-bare-javascript.test.ts` walks the
tree and fails if one appears, so the rule is enforced by `deno task ci` rather than left to memory.
Root configuration is TypeScript for the same reason — the PostCSS pipeline is declared inside
`vite.config.ts` rather than in a `postcss.config.js`.

## Exports

**Named exports only. `export default` is a lint error** (`style/noDefaultExport` in `biome.json`).

A default export hides its name from the import site, so the reader has to go and look up what they
just imported, and two modules can bind the same default to different names. A named export states
the symbol at both ends:

```ts
// named: the name is visible at the import site
import { Button } from 'dss-ui-kit';

// default: the name is only decided by whoever imports
import Button from 'dss-ui-kit'; // lint error
```

The one exception is a **root-level `*.config.*` file** — `vite.config.ts`, `tailwind.config.ts` and
anything like them. Those are not imported by library code; their shape is dictated by the tool that
loads them, and Vite and Tailwind both read their config through the default export. The exemption
is scoped to the repository root: a `*.config.*` file inside `src/` or `scripts/` is still an error.

Export the props interface of a component too (`export interface ButtonProps`). TypeDoc reports an
unexported type that a public signature references, which is a signal the public surface is not fully
documented.

`src/index.ts` is the single public surface of the package. A module that is not reachable from it is
not part of the library, and adding to it is a deliberate decision about what the library promises —
not a convenience.

## Imports

- **Anything under `src/` that leaves its own directory imports through the `@` alias**:
  `@/ui/button`, `@/lib/math`, `@/index.css`. Never `../`, never `../../`. A relative path makes the
  reader count directories up to the root before they know what is being imported, and it silently
  breaks when a file moves. Biome's `noRestrictedImports` rejects `../**` inside `src/`, and nothing
  else.
- **A sibling may be imported as `./name`.** `./button` from inside `src/ui/` names exactly one
  file and cannot be misread, which is why 35 of the copied components already do it. The rule is
  about not walking *up* the tree, and `./` does not. The copy is inconsistent — `ui/icon.tsx`
  reaches `@/lib/dom` and `./icons` in three lines — and stage 3 makes each file pick one habit.
- `scripts/` runs directly under Deno, outside the Vite alias, so it keeps single-level
  `./lib/conventional.ts` imports. `../**` is still rejected.
- The `@` alias is declared twice and both halves must agree — `resolve.alias` in `vite.config.ts`
  for the bundler, and `compilerOptions.paths` in `tsconfig.json` for the type checker.

The `@` prefix is inherited from the original application, which already aliased it, so the copy's internal
imports need no rewriting. Only the imports that cross the library boundary do.

## Layering

**This is the rule the whole decoupling turns on.**

```
src/lib/      hooks and framework-agnostic helpers   ← may import: src/lib/ only
src/ui/       components                            ← may import: src/lib/, src/ui/,
                                                       and the infrastructure modules below
src/locale.tsx, src/theme.tsx, src/event.tsx,
src/feature_flag.tsx          infrastructure        ← may import: src/lib/, and each other
src/index.ts                  the public surface    ← may import: anything above
```

**`src/ui/` and `src/lib/` may not import anything else.** They may not import a module that reaches
`@/def`, `@/api`, `@/contact`, `@/robject`, `@/sensor` or `@/server_nd_type` — not directly, and
not through one hop. Fourteen components currently reach four infrastructure modules (`@/locale`,
`@/theme`, `@/routing`, `@/locale_schema`); those four are the sanctioned way in, and
[`TODO.md`](./TODO.md) stages 6–8 are what free them from `@/def`.

The one direction the copy never uses is the one the rule forbids: nothing in `src/lib/` imports
`src/ui/`, while 26 files in `src/ui/` import `src/lib/`. Helpers do not know what renders them. A
helper that starts needing a component is a component, and it moves to `src/ui/`.

That is not free advice, and `src/lib/color_picker.tsx` is why: seven React components and 1 024
lines live in the helpers directory, imported only by `ui/color_popover.tsx`. Stage 3 moves it to
`src/ui/`; until then it is the one known exception to its own layer.

Anything a component needs from the application — a route, a locale string, the current theme — is a
**prop** or one of those four modules. A component that reaches past them for it is a component that
cannot ship, and the fix is to move the decision up to the caller, not to widen the layer.

This is checked by a test, not by review: `scripts/module-boundary.test.ts` walks `src/` and fails
if a file under `src/ui/` or `src/lib/` imports a module outside the layers above.

## Types

- **`any` is forbidden.** It switches off checking for everything that passes through it, and the
  damage is invisible at the point of use. Where a value genuinely has no useful type — parsed JSON,
  a caught error, an event payload — declare it `unknown` and narrow it. `unknown` is not a
  loophole: assigning it to a `string` still requires the narrowing.
- No non-null assertions (`!`) in library code. Assert what you have actually checked, or handle the
  absence. The copy is full of them, inherited from a `biome.json` that switched the rule off.
- `erasableSyntaxOnly` is on, so enums, namespaces and parameter properties are rejected. Use a
  `type` union or a `const` object instead.
- `noPropertyAccessFromIndexSignature` is on, so a value from an index signature is read with
  brackets: `groups['type']`, not `groups.type`. When that gets noisy, narrow it once into a named
  type rather than casting at each use.
- **No domain types.** A `BCPType`, a `TCOType`, a `RObjectState` or a `Sensor` appearing in a public
  signature is a defect: it names a type no consumer can satisfy. Model the shape the component
  actually renders and let the consumer adapt — which is what makes a component generic over its
  data rather than over our protocol.

## Readability

This is long-lived production software that other people depend on, not a prototype. These are not
stylistic preferences; each one has caught a real problem.

- **Write the obvious version.** No clever one-liners, no chained transformations that need a
  comment to decode, no tuple used as a struct. Code that is shorter is not code that is clearer.
- **No duplicated logic, and none that forces a second edit.** A list, a regex or a mapping needed
  in two places belongs in one exported place. Duplication is a defect when a change then has to be
  made in both copies. Ask of any repeat: does keeping it mean that the next change to this fact is
  made once, or twice?
- **Keep functions short and named for what they do.** Biome's `noExcessiveCognitiveComplexity`
  allows 12; a function that reaches it is doing more than one job and wants splitting.
- **Do not widen a type to silence a check.** A cast is a claim you could not prove. Narrow the
  input instead, or make the function return the type you actually meant.
- **Name things for what they are, not for how they are built**: `DEFAULT_SECTION_HEADING`, not
  `SECTION_FALLBACK`.
- **Leave code better typed than you found it.** If a new lint rule flags something you did not
  write, fix it properly instead of narrowing the rule or adding a suppression.

## Preact through the React compatibility layer

The codebase is written against the **React** API and runs on **Preact**. Do not "fix" `react`
imports by rewriting them to `preact/...`.

- Import from `react`, `react-dom` and `react-dom/client` exactly as you would in React.
- Vite aliases them to `preact/compat` (see `vite.config.ts`). **Order matters**: the more specific
  `react/jsx-runtime` and `react-dom/client` entries must stay above the bare `react` / `react-dom`
  entries, otherwise the generic alias wins and resolution breaks.
- TypeScript resolves the same mapping through `compilerOptions.paths` in `tsconfig.json`. If you
  add a new `react`-family subpath, add it to **both** `vite.config.ts` and `tsconfig.json`.
- JSX uses the automatic runtime with `jsxImportSource: "preact"`. No `import React` needed.
- **Preact is a peer dependency, not a dependency.** The library runs on the Preact the consumer
  already has; bundling its own would put two copies in one bundle and break hooks.

The copy was written against the original application's vendored Preact, which is aliased the same way. Its
`react` imports stay exactly as they are.

## Styling

### The CSS custom-property contract

The design system is **119 CSS custom properties** named `--color-*`, defined per theme:

```css
/* theme_dark.css */
body {
  --color-bda: var(--color-red-light); /* Background: Danger */
  --color-bdat: var(--color-white); /* Text above Danger background */
}
```

Tailwind exposes each one as a colour utility, which is how the components reference them —
`bg-bda`, `text-bdat`, `border-tpl`, `placeholder-tpd`, `fill-tok`. `tailwind.config.ts` declares
them as `{ bda: 'var(--color-bda)' }`, so the class name and the custom property cannot drift apart.

**These names are part of the package's contract.** A consumer that wants `bg-bda` has to have the
`--color-bda` variable defined, so the theme files and the Tailwind config ship together and neither
is optional. Renaming a token is a breaking change; adding one is not.

**A theme is data, not a build artefact.** `--color-bda` is resolved at runtime by CSS, so switching
theme is a `data-theme` attribute on `<body>` and nothing is recompiled.

### Tailwind CSS 3

Tailwind 3, compiled through PostCSS declared inside `vite.config.ts`. There is no
`postcss.config.js`.

The copy ships `src/css/utility.css` — 4 855 lines of **checked-in compiled Tailwind output**, a
build product of the original application's esbuild step. It is deleted in [`TODO.md`](./TODO.md) stage 4 and
replaced by a real pipeline, because a consumer's build has to be able to compile against the
library and a stale checked-in build is a silent defect.

A consumer's `tailwind.config.ts` has to scan the published package for class names, and the library
has to make that possible: the classes it renders must be discoverable from the shipped source, not
only from this repository.

### Class names

The copy concatenates class strings with template literals and appends a `className` prop directly,
so a caller's `className` loses to the component's own when both set the same property. The
components take a `cn()` helper built on `tailwind-merge`, which is what the consuming application already
does — so `className` from the caller wins and the two do not fight.

## Localisation

The interface ships in **Russian and in English**, and both versions are complete: the locale the
browser asks for, and nothing else. A missing translation is a defect, not a degraded mode.

**The library renders no user-facing text of its own beyond what its components need.** Every string
an operator reads comes from the locale files, and a component holds a key, never a literal.

- `src/locales/en.ts` holds every message the library renders, in English; it is the source of the
  message key set.
- `src/locales/ru.ts` holds the same keys in Russian; it is the only file allowed to contain Russian.
- `MessageKey` is **derived from the English locale**, so a key has to exist before a component can
  name it, and every other locale is typed `Record<MessageKey, string>` — a message missing from
  `ru.ts` is a type error, not a blank label on a panel an operator is reading.

The copy keeps the library's message set: 3 038 keys in the source, of which the components name 33
as literals. Cutting it down to what the library renders is [`TODO.md`](./TODO.md) stage 7 — the rest
belong to the consumer, and shipping them would put the original application's vocabulary in a package that has no
business holding it.

A component that needs a literal of its own — a device identifier, a version string — renders it as
data. Only text meant to be read by an operator belongs in a locale file.

A test walks the tree and fails on a Cyrillic letter anywhere outside the locale files, so Russian
text cannot drift back into a component between reviews.

## Dependency versions

**Every version in `package.json` is pinned exactly — no `^`, no `~`.** Reproducible installs are a
release requirement, so an unpinned version is a bug, not a convenience.

After editing dependencies, always refresh the lockfile and commit it:

```bash
deno add npm:some-package   # or: deno add --dev npm:some-package
deno task install:frozen    # verifies package.json and deno.lock agree
```

`deno install --frozen` fails if the lockfile is stale, so never edit `deno.lock` by hand. CI runs
it before every job.

## Commands

```bash
deno install              # install/refresh dependencies (run after editing package.json)
deno task install:frozen  # verify package.json and deno.lock agree (what CI does)
deno task dev             # dev server on http://127.0.0.1:5173
deno task build           # production build into dist/
deno task preview         # serve the production build on http://127.0.0.1:4173
deno task lint            # biome ci + typecheck
deno task format          # biome check --write (apply safe fixes)
deno task typecheck       # tsgo only
deno task test            # unit tests
deno task docs            # TypeDoc API reference into docs/api/
deno task ci              # the full local gate, exactly what CI runs
```

`deno task ci` must pass before any commit. It chains `install:frozen`, `format:check`, `lint`,
`test`, `build` and `docs`, which is the whole of the GitLab pipeline in one command. If Biome
reports a fixable problem, run `deno task format` rather than editing by hand. The release commands
are not here because they are the maintainer's alone — see [Releasing](#releasing).

## Continuous integration

[`.gitlab-ci.yml`](./.gitlab-ci.yml) defines a strict pipeline: `setup` (frozen install) → `format`,
`lint`, `typecheck`, `test`, `commit-message` → `build`, `docs`, plus a `release-preview` job on
`v*` tags. `biome ci` treats formatting as an error, so an unformatted file fails the pipeline.

The pipeline is inherited from the consuming application and keeps the same shape deliberately: one gate,
run the same way locally and in CI, so a green pipeline and a green `deno task ci` mean the same
thing.

## Project layout

```
src/
  index.ts                the package's public surface; the only entry point consumers need
  lib/                    hooks and framework-agnostic helpers
  ui/                     components
  ui/icons/               icon path data, generated from ui/icons/*.svg
  locale.tsx              message lookup, locale detection, useLocale
  locales/                en.ts and ru.ts — every message the library renders
  theme.tsx               theme names and the current theme
  event.tsx               the event bus
  feature_flag.tsx        feature flags
  css/                    theme custom properties, global styles, Tailwind entry point
  index.css               Tailwind entry point (index.css is the only global stylesheet)
scripts/
  commitlint.ts           Conventional Commits validator (used by the git hook)
  lib/                    helpers for the scripts above
docs/
  api-intro.md            landing page for the generated API reference
  api/                    TypeDoc output, generated and not committed

vite.config.ts            bundler config; also declares the PostCSS pipeline
tailwind.config.ts        design tokens
tsconfig.base.json        strict compiler options shared by both tsconfigs
tsconfig.json             library compiler options and the @/ paths
tsconfig.node.json        tooling compiler options (Vite, Tailwind, scripts/)
biome.json                the single formatter and linter
```

`src/lib/` and `src/ui/` are the reusable payload and are clean of domain code already — roughly
17 000 lines that need reformatting and an entry point, not rewriting. The application screens and
`@/def` coupling live in the top-level `src/*.tsx` files and are removed by
[`TODO.md`](./TODO.md) stage 10.

### File naming

**A file that exports a React component is named after the component, in PascalCase.** The file
`StatusLight.tsx` exports `StatusLight`; `OverviewPage.tsx` exports `OverviewPage`. This is the
standard React convention and it makes the import statement read as the symbol it binds.

Everything that is not a component keeps a lowercase, dash-separated name describing what it is:
`cn.ts` for a helper, `domain.ts` for a group of types, `main.tsx` for the browser entrypoint.

**The copied modules keep their `snake_case` names.** `filterable_table.tsx`,
`use_event_listener.tsx` and `use_granular_effect.tsx` are the names they have in
the original application, and keeping them means a reader holding the two side by side can tell at a
glance that a file is unchanged, which is worth a great deal while 261 files are being sorted into
layers. Renaming them is a separate, mechanical change with its own commit, and never mixed into a
change that moves code between layers.

Do not mix the two styles in one directory.

## Documentation

The API reference is **generated from the source** by TypeDoc, which reads the TSDoc comments:

```bash
deno task docs          # writes docs/api/
deno task docs:watch    # rebuilds on save
```

- Entry points and output are configured in `typedoc.json`; TypeScript options live in
  `tsconfig.docs.json` so documentation never depends on the build settings.
- `docs/api/` is gitignored. The HTML is a build output, not source; committing it would guarantee
  it drifts out of date the first time a comment changes.
- CI builds it, so a broken `@link` or an unresolvable type fails the pipeline. Edit the comment,
  never the HTML.
- Write TSDoc for the **why**. A comment that restates the signature is noise; one that explains why
  a missing device is never downgraded to a fault is documentation.
- Document the public surface. Exported symbols that TypeDoc cannot resolve are reported as warnings
  — that is the signal that something is under-documented.
- **Say it once, and only where it belongs.** Give every fact one home: the file layout, the
  layering rule, the command list and the conventions each belong to exactly one section. A fact
  worth reaching from a second document gets a pointer to that section, never a copy of its text.

The most useful comment in a UI library is the one that says what a component will not do — what it
assumes, what it leaves to the caller, and what it deliberately does not handle. A consumer cannot
find that out by reading the types.

## Language

- **Code, identifiers, and comments: English.**
- **User-facing text: the locale files.** Every string a person reads lives in `src/locales/`.
- **Markdown documentation: English.** The glossary in this file is the one place a domain acronym
  is spelled out.

The source this came from is a Russian-language product, and the component names and locale keys
inherit that (`bcpTitleMain`, `kauConfigTab`, `zoneManager.*`). **Do not translate or rename them as
part of the decoupling.** A key rename forces an edit in every consuming file and buys nothing but a
cleaner-looking diff; if the vocabulary is wrong, that is a change with a migration, taken on its
own.

## Testing

`deno task test` runs the suite. Add tests next to what they cover: `src/**/*.test.ts` beside the
component or type, `scripts/**/*.test.ts` beside the helper. The repository-policy tests —
`no-bare-javascript`, `module-boundary` and `no-russian-text` — are the exceptions: they guard
repository-wide rules rather than one module, so they sit beside the tooling they protect and share
its tree walker (`scripts/lib/source-tree.ts`).

The copy arrives with no tests at all, which is why [`TODO.md`](./TODO.md) stage 11 exists: the pure
helpers first, since they carry the most logic per line, then a render test per component.

## Git and versioning

**Every commit message must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).**
A `commit-msg` hook in `.githooks/` enforces this (it is wired up via `core.hooksPath`); a bad
message will be rejected.

```
<type>(<scope>): <description>
```

Allowed types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `style`, `chore`,
`revert`.

Rules:

- Lowercase type, no trailing period on the subject.
- Use a scope when one applies (`config`, `events`, `icons`, `locale`, `styles`, `ui`, `lib`).
- Write the description in the imperative mood, describing the change rather than the activity:
  `refactor(ui): merge Tailwind classes with tailwind-merge instead of concatenating`, not
  `changed class handling`.
- Breaking changes: append `!` to the type/scope **or** add a `BREAKING CHANGE:` footer. Use only
  one, never both — and read [What counts as breaking](#what-counts-as-breaking) first, because the
  answer is almost always no.

### What counts as breaking

**Semver here is deliberately loose.** The version is a statement about the software as a whole, not
a running count of every change, so the major version stays a number a human can remember. A major
bump means one thing: **a substantial rewrite or rework of the entire library, or of one of its
significant interfaces** — the public surface in `src/index.ts`, the CSS custom-property contract, or
the event bus a consumer listens to.

Everything else is a minor or a patch, however large the diff looks:

- **A visual change is never breaking.** A new colour, a different layout, a rewritten component —
  these are minor. Nobody compiles against our markup.
- **Renaming an internal module is not breaking.** Consumers import from `src/index.ts` and nothing
  else, so `refactor` is the honest type for a rename, however many identifiers it touches. A rename
  of something already exported from `src/index.ts` **is** breaking.
- **Adding a CSS custom property is not breaking.** Renaming one is — see
  [The CSS custom-property contract](#the-css-custom-property-contract).
- **A change a maintainer notices and a consumer does not is not breaking.** A dependency bump, a
  build change, a test, a comment.

When in doubt, ask what a consumer outside this repository would have to do differently. If the
answer is "nothing", it is not breaking. `deno task release` turns a single `!` straight into a
major bump, so the marker is not something to reach for to make a commit look important.

## Releasing

> **Only the project maintainer bumps the version.** Do not run `deno task release` to bump a
> version, write the changelog or tag a release unless the maintainer has explicitly asked for it in
> this session. The version is a statement the maintainer makes about the software; a release made
> on their behalf is one they did not choose, and the number cannot be walked back without rewriting
> the history. Reading the history and reporting what a release *would* produce is fine:
> `deno task release --dry-run` writes nothing.

```bash
deno task release --dry-run    # preview version + changelog entry
deno task release              # bump package.json, write CHANGELOG.md, commit, tag
deno task changelog            # rebuild CHANGELOG.md from git history
```

The script reads the git history since the latest `v*` tag, derives the release type, writes the
`package.json` version and the changelog entry, creates a `chore(release): <version>` commit and an
annotated `v<version>` tag. It refuses to run with a dirty working tree or staged changes, and it
runs `deno task lint` first.

Never hand-edit the `version` field in `package.json` or the generated sections in `CHANGELOG.md`.
Both are owned by the script.

## Before you finish

- `deno task ci` passes (this is the CI gate).
- If you touched `package.json`, `deno.lock` is refreshed and `deno task install:frozen` passes.
- Nothing under `src/ui/` or `src/lib/` imports a module outside its layer — see
  [Layering](#layering).
- No new CSS custom property is introduced without its Tailwind colour in `tailwind.config.ts`, and
  no existing one is renamed.
- New UI strings are in both locale files; new code and comments are in English.
- Public exports are named, and a component's props interface is exported beside it.
- If you were given tasks from [`TODO.md`](./TODO.md) and implemented one, tick its box (`- [x]`) in
  the same change as the work. A box is a claim that the task is done, so it is backed by a passing
  `deno task ci` — or, for the stages that come before the toolchain exists, by that stage's own
  definition of done. Never tick a box ahead of the code it claims.
- The commit message follows Conventional Commits.
- If the change is visible to a consumer — a component, a token, an export — say so in the commit
  body.