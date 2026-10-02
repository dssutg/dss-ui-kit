# TODO

The work still to be done, in the order it should be done. A ticked box means the task is
implemented and `deno task ci` passes.

## What this repository is

The UI library extracted from the original application (the original application) so that
the consuming application can consume it as a third-party dependency.

The starting point is a **file-level copy**: 261 files, 35 490 lines of TypeScript and 5 455 of CSS,
taken byte for byte from `webui/`. Only `src/main.tsx` differs, and only because it was truncated
mid-refactor. Nothing was adapted, so the copy does not compile — 22 import specifiers resolve to
modules that were never copied. The stages below take it from that state to a published package.

Everything here is inherited from the consuming application unless a stage says otherwise: Deno 2, Vite 8,
Tailwind CSS 3, Preact through the React compatibility layer, Biome, tsgo, Vitest and TypeDoc. The
toolchain and every convention live in [`AGENTS.md`](./AGENTS.md); this file holds only the steps.

## What was copied, and what it means for the stages

Measured on the copy as it stands:

| Area                                | Size                    | State                                                                   |
| ----------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `src/lib/`                          | 50 files, 8 271 lines   | Framework-agnostic helpers and hooks. **No domain imports at all.**      |
| `src/ui/`                           | 31 files + 142 icons    | Components. No domain imports, but 14 of them reach four library-bound infrastructure modules. |
| `src/css/`                          | 10 files, 5 455 lines   | Themes as CSS custom properties, plus a **checked-in Tailwind build**.   |
| `src/locales/` + `locale_schema`   | 3 files, 9 946 lines    | 3 038 message keys, far more than the library uses.  |
| `src/*.tsx`                         | 14 files, 11 459 lines  | Infrastructure **and** application screens, not separated.              |

Three facts shape the plan more than anything else:

- **`src/lib/` and `src/ui/` carry no domain code.** No file in either directory imports `@/def`,
  `@/api`, `@/robject`, `@/sensor`, `@/server_nd_type` or `@/contact`. They are the reusable
  payload — roughly 17 000 lines that need reformatting and an entry point, not rewriting.
- **Everything that is coupled sits in 14 top-level files**, and the coupling runs through four
  modules: `@/locale` (12 components), `@/theme` (2), `@/routing` (2), `@/locale_schema` (1). Each
  of those four currently reads `@/def` for app state. Decoupling the four decouples the components.
- **The design system is 119 CSS custom properties**, `--color-bda`, `--color-tpl` and so on, used as
  Tailwind colour utilities (`bg-bda`, `text-tpl`). They are what a consumer's `tailwind.config.ts`
  has to reproduce, so they are part of the package's contract, not an implementation detail.
- **34 of the 81 files in `src/lib/` and `src/ui/` have no importer inside this copy**, because the
  application screens that used them were not copied. They are not dead — only four are, and only
  after checking the original application for each one. Do not prune on "unused in this repository".

### The 22 unresolved imports

Grouped by what has to happen to them, not by file:

| Missing module                                                                                       | Imported by                                | Stage |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----- |
| `@/api`, `@/ws_client`                                                                                | `main.tsx`, `event.tsx`                    | 6     |
| `@/def`                                                                                               | 8 files                                    | 8     |
| `@/robject`, `@/sensor`, `@/server_nd_type`, `./chart`                                             | `filterable_table.tsx`                     | 9     |
| `@/contact`                                                                                           | `copyright.tsx`, `logo.tsx`, `crash.tsx`   | 10    |
| `@/app_chart`, `@/app_console`, `@/app_type`, `@/bcp_control_panel`, `@/bcp_standby_panel`, `@/config`, `@/confirmation_window`, `@/debug_mode`, `@/draw`, `@/overlay`, `@/resource`, `@/settings`, `@/server_panel`, `@/ui_builder` | `main.tsx` only | 10 |

Three of the 22 are shared: `@/api` is wanted by both `main.tsx` and `event.tsx`, `@/contact` by three
files, and `@/def` by eight. A stage that removes one importer does not remove the import, and the
module only goes when the last one does.

`server_rack.tsx` also imports `@/shaders/rack_vertex.glsl?raw` and `@/shaders/rack_fragment.glsl?raw`.
Those two are *not* in the table: Vite's `?raw` suffix is a query, not a path, and both files are
present under `src/shaders/`. They are the only two imports in the copy that resolve.

## 1. Initialize AGENTS.md

The constitution, written before any code moves. Every later stage is judged against it, and an
unstated convention is a convention the next contributor will guess at.

This stage has no toolchain to run, so it is gated by itself: both documents are done when every
claim in them is either true of `src/` today or named in a later stage below as the thing that
arrives it.

- [x] Write [`AGENTS.md`](./AGENTS.md).
  - [x] State what the library is and what it is not: a component and design-token library, with no
        domain model, no protocol and no application shell.
  - [x] Fix the toolchain table, inherited from the consuming application: Deno 2, Vite 8, Tailwind CSS 3,
        Preact via `preact/compat`, Biome, tsgo, Vitest, TypeDoc.
  - [x] Write down the conventions that change during this work, so a reformat in stage 3 is a
        mechanical step rather than a debate: named exports only, `@/` imports only, no `any`, no
        non-null assertions, `import type` for type-only imports, no bare JavaScript.
  - [x] Document the CSS custom-property contract and the rule that a theme is data, not a build
        artefact.
  - [x] Document what a component may depend on: `src/lib/`, `src/ui/` and the four infrastructure
        modules — and nothing above them.
  - [x] Add a "Before you finish" checklist, including the rule that a ticked box in this file is a
        claim backed by a passing `deno task ci`.

## 2. Toolchain

Bring the inherited configuration over, so that from here on every stage is measurable.

- [x] Copy the configuration from the consuming application, adjusting only what the library differs in.
  - [x] `package.json`, `deno.json`, `deno.lock`, pinned exactly — no `^`, no `~`.
  - [x] `tsconfig.base.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.docs.json`.
  - [x] `biome.json`, `.editorconfig`, `.gitignore`, `.gitattributes`.
  - [x] `vite.config.ts`, with the PostCSS pipeline declared inline rather than in a
        `postcss.config.js`, and the `@` alias plus the `preact/compat` mappings.
  - [x] `.gitlab-ci.yml` and `.githooks/commit-msg`, plus `scripts/commitlint.ts`, for Conventional
        Commits.
  - [x] `typedoc.json` and `docs/api-intro.md`.
- [x] `deno install`, then `deno task install:frozen`.
- [x] Confirm the inherited `biome.json` rules survive contact with this code base.

### What the inherited rules found

`deno run -A npm:@biomejs/biome ci .` on the copy, before any reformat: **849 errors and 24 warnings**
across 277 files. Five rules did not fit this library and are turned off or narrowed; everything
else is left as an error for stage 3 to fix in the code.

> **`biome.json` must not contain a comment.** Biome 2.5.14 accepts JSON with comments in
> `biome.json` and then silently discards the whole `overrides` array, so every rule listed in the
> table below stops being turned off and the reason given for it quietly stops being true. It fails
> without a warning, which is why it is worth knowing: a `//` written next to a setting to explain
> it turns the three overrides beneath it into no-ops. The reasons therefore live here and in
> [`AGENTS.md`](./AGENTS.md), not in the config. `scripts/lint-overrides.test.ts` fails on a comment
> in `biome.json` so this cannot come back unnoticed.

| Rule | Hits | Decision |
| ---- | ---: | -------- |
| `noSvgWithoutTitle` | 142 | **Off for `src/ui/icons/**`.** Those files are generated path data, not images: `ui/icons/index.tsx` reads the `d` attribute out of each and the `Icon` component builds the `<svg>` itself, with `aria-hidden` set and the accessible name coming from the control around it. A `<title>` in these files would never reach the accessibility tree. |
| `noRestrictedImports` | 35 | **Narrowed to `../**` inside `src/`.** Every hit is a sibling import (`./button`, `./icon`) inside `src/ui/`, which [`AGENTS.md`](./AGENTS.md) permits. Only walking up the tree is forbidden. |
| `noDefaultExport` | 2 | **Off for `**/*.d.ts`.** `src/tsimport.d.ts` declares `*.glsl?raw` and `*.txt?raw`, and an ambient module declaration has no way to say anything else. |
| `useComponentExportOnlyModules` | 43 | **Off for the whole repository.** The rule protects Fast Refresh: a module that exports a component alongside a constant cannot be hot-replaced without losing its state, so it asks for the two to be split. This repository has no `index.html` and no dev entry point — `build.lib` is `src/index.ts` and a consumer imports the built package pre-bundled — so there is no dev server on which Fast Refresh could run against this source. Splitting twenty files would make the source harder to follow for a benefit that cannot be reached. |

| `noAutofocus` | 5 | **Off for `src/**`.** All five are a component forwarding the caller's `autoFocus` prop: `TextInput`, `SearchInput`, `NumberInput`, the CodeMirror editor wrapper and the tree's rename field. The rule catches an author stealing focus on page load, which is the defect it was written for; it cannot tell that a dialog is asking for its first field to take focus when it opens, or that a rename field has to be ready to type into. A component library that refuses to express the decision cannot be used in a dialog at all, so the prop stays and the rule is off for the library source. It is not off for `scripts/`. |

Two rules were expected to need a decision and did not get one, which is the outcome worth recording:

- **`useNamingConvention` (16 hits) is not relaxed.** Biome 2.5 has no `leadingUnderscore` option and
  no `_camelCase` format, so the underscore convention in `lib/autosizer.tsx` (`_autoSizer`,
  `_parentNode`), `lib/dom.tsx`, `lib/editor.tsx` (`function_`, `arguments_`) and `lib/date.tsx`
  (`_`) cannot be expressed in configuration. Sixteen renames in stage 3 are cheaper than a rule
  that has been turned off, and the renames are the fix.
- **`noExcessiveCognitiveComplexity` (37 hits) is not relaxed.** They concentrate in the two
  components stage 9 rewrites anyway (`filterable_table.tsx` and `server_rack.tsx`, 5 each) and in
  `ui/tree.tsx` (5). The cap stays at 12.

The largest remaining block is `noNonNullAssertion` at 341, which [`AGENTS.md`](./AGENTS.md) forbids
outright; that is stage 3 work, not a config change.

### Where each command stands

The toolchain runs; the copy it runs against is not yet decoupled. Measured on the tree as it stands
after stage 2, so the next stage starts from a number rather than a guess:

| Command | State | Why |
| ------- | ----- | --- |
| `deno task install:frozen` | passes | `package.json` and `deno.lock` agree. |
| `deno task lint:types` (tooling half) | passes | `tsconfig.node.json` covers `vite.config.ts`, `tailwind.config.ts`, `vitest.config.ts` and `scripts/`. |
| `deno task lint:types` (library half) | fails | The 22 unresolved modules, plus the copy's own `exactOptionalPropertyTypes` and implicit-`any` errors. |
| `deno task lint:biome` | fails | 670 errors, 24 warnings — the copy's debt, analysed above. |
| `deno task format:check` | fails | 110 files are not yet formatted. That is stage 3, in its own commit. |
| `deno task test` | fails | `no-bare-javascript` passes; `no-russian-text` fails on the six known findings. |
| `deno task build` | fails | `Cannot resolve entry module src/index.ts` — stage 5. |
| `deno task pack` | fails | It validates what the build produced, and there is no `dist/`. |
| `deno task docs` | fails | 181 type errors, from the same unresolved modules. |

Nothing above is a configuration defect. Each is the copy being what it is, and the stage that removes
the cause is named in the same row.

### The one thing stage 2 had to fix in the inherited scripts

the consuming application has no `vitest.config.ts`, so its tests run in the default `node` environment and
`scripts/lib/source-tree.ts` can find the repository root through `import.meta.url`. This library needs
a `vitest.config.ts` — the `@` alias and the `preact/compat` mappings have to be in the test pipeline
for stage 11's render tests — and setting its environment to `jsdom` broke that walk, because jsdom
replaces the global `URL` and `new URL('../..', import.meta.url)` then resolved to
`http://localhost:3000/@fs/...` instead of a `file:` URL. Both suites crashed before running a single
assertion.

The fix is in two parts, and the second matters more than the first. `source-tree.ts` now derives the
root from `import.meta.dirname`, which is a path and does not care which globals the environment
installed; and `vitest.config.ts` defaults to `node`, with a component test declaring
`// @vitest-environment jsdom` in the file that needs a DOM. A suite that walks the filesystem or
builds a URL should not be running in a DOM emulation, because it will pass there and fail in the
runtime it ships in. The six Russian-text findings the walk then surfaced are stage 7's work.



## 3. House style

The copy is formatted with tabs, double quotes and a line width of 319. the consuming application uses
two spaces, single quotes and a width of 100. Every stage after this one would otherwise be a diff
against a moving target.

- [x] Reformat `src/` and settle the resulting lint findings.
  - [x] Run `deno task format` over the copy; commit as its own change so the reformat diff is
        readable on its own.
  - [x] Then fix what `deno task lint:biome` reports, file by file, and record every rule that had to
        be relaxed rather than fixed — a suppressed rule is a decision that needs a reason.
  - [x] Move `src/lib/color_picker.tsx` to `src/ui/`. It is 1 024 lines exporting seven React
        components and is imported by exactly one file, `ui/color_popover.tsx`, so it is the one
        file in `src/lib/` that breaks the layer rule in [`AGENTS.md`](./AGENTS.md).
  - [x] Drop the four modules the original application no longer imports either:
        `base64_response_parser`, `primitive`, `simplex`, `use_mouse_drag_on_element`.

## 4. Tailwind pipeline

The library ships a **checked-in Tailwind build**, `src/css/utility.css` — 4 855 lines of compiled
output, produced by the original application's esbuild step and never regenerated. A consumer's build must be
able to compile against it, and a stale checked-in build is a silent defect.

- [x] Replace the checked-in build with a real Tailwind CSS 3 pipeline.
  - [x] Add `src/index.css` with the three directives, and delete `src/css/utility.css`.
  - [x] `tailwind.config.ts` declaring all 119 tokens as colours of the form
        `bda: 'var(--color-bda)'`, so `bg-bda` and `text-tpl` resolve in the consumer too.
  - [x] Keep `@tailwindcss/forms`, which the `Input` component's styling assumes.
  - [x] The `content` globs must cover a consumer that imports the built package, not just this
        repository's own source — decide whether that means shipping the classes as CSS or as a
        published Tailwind preset, and record the choice.
- [ ] Split the themes so a consumer imports the one it uses.
  - [ ] `theme_dark.css` and `theme_light.css` stay; `theme_acme`, `theme_indigo` and `theme_purple`
        are Sigma-IS house themes and are the consumer's business, not the library's — decide
        whether they ship as an example or are dropped.
  - [ ] `global.css`, `color_picker.css` and `syntax_highlight.css` are needed by the components and
        stay.
- [ ] `tsimport.d.ts` covers `*.svg`, `*.png` and `*.glsl?raw`; keep the declarations, and add the
  `preact` JSX types the consumer needs.

## 5. Entry point and module boundary

What the package exports, and what it refuses to import.

- [ ] Write `src/index.ts` as the single public surface.
  - [ ] Re-export every component and hook in `src/ui/` and `src/lib/` that stage 3 kept.
  - [ ] Named exports only, per [`AGENTS.md`](./AGENTS.md); export the props interface of each
        component beside it.
  - [ ] An application shell demo is **not** part of the entry point. A playground exists so the
        components can be seen running, and it lives outside the package's public surface.
- [ ] Enforce the boundary, because a rule that is only written down is a rule that gets broken.
  - [x] A test that walks `src/` and fails if any file under `src/ui/` or `src/lib/` imports a module
        outside `src/lib/`, `src/ui/` and the four infrastructure modules.
  - [ ] Move the no-bare-JavaScript and no-Russian-text rules onto the same footing as
        the consuming application, which has `scripts/no-bare-javascript.test.ts` and
        `scripts/no-russian-text.test.ts` to copy. The `@`-alias rule has no upstream model — there
        Biome's `noRestrictedImports` is the only thing enforcing it — so it needs a test too, and
        the three should share one tree walker.

## 6. Event bus

`src/event.tsx` is 439 lines, of which 303 are an `EventTypes` map naming 119 application-specific events typed
against `@/def`. The mechanism underneath — `emitEvent`, `useEvent`, `onEvent` over `window`
`CustomEvent`s — is generic and is what the library needs.

- [ ] Keep the mechanism, replace the map.
  - [ ] A library-owned `EventTypes` holding only the four events the library emits:
        `THEME_CHANGED`, `FEATURE_TOGGLED`, `SETTINGS_UPDATE` and `NEW_APP_CRASH_REPORT`. The other
        115 the map names belong to the application, and `server_rack.tsx` only ever *listens* to
        `SERVER_RACK_UPDATE` and `TOGGLE_DEBUG_GUI`, so neither comes into the library at all.
  - [ ] Make the map open at both ends — a consumer extends it with its own events, or subscribes
        through the untyped `emitEvent` / `useEvent` / `onEvent` — so `def.tsx` can keep its 119
        without the library carrying them.
  - [ ] `tsgo` must pass with the application types gone. The current file does not compile without `@/def`,
        so this is the first stage where a module in the library actually builds.

## 7. Localisation

`src/locales/en.tsx` and `ru.tsx` hold 3 038 keys each, and the two files agree key for key;
`locale_schema.tsx` is 3 241 lines of hand-maintained key union that duplicates what the locale
objects already say. The components in `src/ui/` and `src/lib/` name 33 of those keys as literals,
and all 33 are present.

- [ ] Cut the library's message set down to what it renders.
  - [ ] Keep the 33 keys the components name as literals, and follow the one that is built at
        runtime: `tree.tsx` calls `t(item.titleLocaleKey)` and `t(titleLocaleKey)`, so the keys those
        two reach are in the set even though nothing in the source spells them. Enumerate them from
        the call sites rather than assuming the literal list is complete.
  - [ ] Both locales stay complete: a key in `en` and a key in `ru` or it is a type error.
- [ ] Derive `MessageKey` from the English locale rather than maintaining a union by hand, the way
  the consuming application does. 3 241 lines of hand-written union is a file that can only rot.
- [ ] Break the `@/def` dependency.
  - [ ] `useLocale()` reads the active locale from a library-owned store, not from
        `globalState.locale.lang`, and `alterLocale()` writes to that store and emits
        `SETTINGS_UPDATE`.
  - [ ] The store is the subject of stage 8; this stage isolates the locale from it so the two are
        not changed at once.

## 8. Application state

`@/def` is the original application's god module: 3 947 lines that hold the application types, the application state and
the WebSocket plumbing together. Only two of the four infrastructure modules touch it — `theme.tsx`
and `locale_schema.tsx` import nothing from it — and between them they read eight symbols: the state
accessors `globalState`, `global`, `onGlobalStateUpdate` and `useAppState`; the setters
`setRoutingPath` and `setOverlayRoutingPath`; and the types `BCPType` and
`ServerRackDeviceInfoByTco`. `event.tsx` and `feature_flag.tsx` reach it too, and both are handled in
stage 6.

- [ ] Give the library its own minimal store and have the four read that.
  - [ ] A `globalState` holding the active locale, the current theme and the feature-flag map — the
        three pieces of state the library actually owns.
  - [ ] `useAppState(selector)` with the same subscribe-and-select shape, so
        `useLocale`, `useTheme` and `useFeatureFlag` are unchanged at their call sites.
  - [ ] `feature_flag.tsx` reads `global.FEATURE_MAP` and `crash.tsx` reads the global state
        object for serialisation; both get a library-shaped equivalent.
- [ ] Decide what a consumer has to provide. A library that owns a global singleton cannot be
  configured by two applications in one bundle, so either the store is injectable or the
  singleton is documented as the limitation. Write the decision down either way.

## 9. The two large domain components

`filterable_table.tsx` (2 364 lines) and `server_rack.tsx` (3 845 lines) are the bulk of what is left
once everything else is settled. Both are reusable *in shape* and unusable *as written*.

- [ ] Generalise them, or leave them to the consumer.
  - [ ] `filterable_table.tsx` imports eight symbols from `@/def` — the enumerations `BCPType`,
        `NDState` and `TCOType` as types, and `isValidBCPType`, `isValidTCOType`, `ndStateInfoMap`,
        `validBCPTypes` and `validTCOTypes` as the value maps built over them — plus `@/robject`,
        `@/sensor` and `@/server_nd_type` for the per-column state. The types become generic
        parameters; the value maps are the harder half, because a column definition needs somewhere
        to get its display name and its colour from. Budget it as a real refactor.
  - [ ] `server_rack.tsx` is a WebGL rack visualisation with its own GLSL, its own device model from
        `@/def` and two domain events. It is the clearest candidate to stay in the consumer: decide
        explicitly rather than by attrition, and record the reason.
- [ ] Whichever way each goes, neither may be reachable from `src/index.ts` while it still imports
  `@/def`.

## 10. Remove the application from the library

The fourteen top-level `src/*.tsx` files are where the two halves were left mixed together. Five are
infrastructure the library wants — `event`, `feature_flag`, `locale`, `locale_schema`, `theme` — two
are domain components that need rewriting rather than deleting — `filterable_table`, `server_rack` —
and seven are the original application's application code that has no business in a package. The application
code does not belong here, and it is most of the reason the copy does not compile.

- [ ] Delete, without replacement.
  - [ ] `main.tsx` — the application entrypoint, and the source of 18 of the 22 unresolved
        imports. A library has no entrypoint; the consumer's `main.tsx` is the consumer's.
  - [ ] `prebundle.tsx` — 273 lines of legacy-browser polyfills loaded before the app bundle. Ask
        whether the consumer needs any of them, and take only what it can justify; `Object.hasOwn`
        and `toSorted` are the plausible keepers.
  - [ ] `index.html` — a page that loads `webui/prebundle.tsx` and `webui/main.tsx`, with the BCP's
        server-side URI substitution baked into it.
  - [ ] `routing.tsx` — a route table over the original application paths, with `setRoutingPath` and
        `setOverlayRoutingPath` writing straight into `globalState`. A library has no routes. The two
        `ui/` components that import it — `button.tsx` and `tree.tsx` — take a navigation callback as
        a prop instead, which is the same treatment the four infrastructure modules get in stages
        6–8.
  - [ ] `top_down_triangle_light_ray_overlay.tsx` — a 13-line overlay for the login screen, which is
        the consumer's screen.
- [ ] Move to the consumer, or keep with the coupling removed.
  - [ ] `copyright.tsx`, `logo.tsx` and `crash.tsx` all read `@/contact` for an address and a
        phone number. A crash guard belongs in the library; the Sigma-IS contact details do not.
  - [ ] `sfx/notification0.ogg` is imported only by `@/def`, so it arrives here with no importer.
  - [ ] `images/favicon.ico` and `topDownTriangleLightPngBase64` belong to a page the library does
        not have.
  - [ ] `convertPngToBase64.go` and `convertOggToBase64.go` are the original application's asset pipeline. The
        generated `.tsx` files they produce ship; the generators do not.

## 11. Tests

The copy has none, and it arrives as 35 490 lines of TypeScript that nobody has run.

- [ ] Add unit tests for the pure logic that carries real risk and is already written:
  `lib/array`, `lib/math`, `lib/dsv`, `lib/string`, `lib/pluralization`, `lib/fuzzy_search`,
  `lib/ipv4`, `lib/format_number`, `lib/validator`, and the locale lookup in stage 7.
- [ ] Add a render test per component, driven by Preact through the compat layer, so a component that
  stops rendering is a failing test rather than a blank page in someone else's application. Each one
  opens with `// @vitest-environment jsdom`; the default environment is `node`, and the reason is
  recorded in stage 2.
- [x] Port `scripts/no-bare-javascript.test.ts` and `scripts/no-russian-text.test.ts` from
  the consuming application, so the rules they guard are enforced from stage 2 rather than from here. Both
  share `scripts/lib/source-tree.ts`. `no-bare-javascript` passes; `no-russian-text` is red on six
  findings, listed in stage 2, and is not to be relaxed to make it green.

## 12. Publish

- [ ] `package.json` metadata: name, description, licence, `files`, `sideEffects` for the stylesheet
  entry point, and the `peerDependencies` on `preact` — a UI library must not pin the consumer's
  Preact, or the consumer ends up with two.
- [ ] **Confirm the published tarball is domain-independent.** The repository is MIT-licensed, so
  anything left in `src/` is covered by that licence; a leftover original application module would be published by
  accident. This is the gate for it: `deno pack`, then read the file list and check every entry is
  either a component, a hook, a locale file, a design token or a build artefact. A domain type, a
  Sigma-IS contact detail or an event name is a release blocker, not a warning.
- [ ] `README.md`: what the library is, the install line, the Tailwind setup a consumer has to
  perform, the CSS custom-property contract, and a component index.
- [ ] `CHANGELOG.md` in Keep a Changelog form, and `scripts/release.ts` on the inherited git-tag
  versioning.
- [ ] `deno task docs` produces the API reference from TSDoc comments, with the props interface of
  every component documented.

## 13. consume it from a consumer

The only stage that proves the other twelve. Until a real application builds against the package,
every stage above is an assertion. The consumer is not waiting on a vague intention: the first stage
of the consuming application's own [`TODO.md`](../the consuming application/TODO.md) is to integrate this
library, and its four sub-tasks are what this stage has to satisfy.

- [ ] `deno add npm:...` the published package, pinned exactly, in the consuming application, and commit
  the refreshed `deno.lock`.
- [ ] Give the consumer's `tailwind.config.ts` the library's token set and the same Preact
  compatibility layer the application runs on, so `bg-bda` and `text-tpl` resolve against the
  library's components.
- [ ] Move a presentational component of `src/components/` onto a library component, leaving
  `StatusLight` and the traffic-light mapping of `src/types/domain.ts` where they are — the consumer
  has already decided those two stay.
- [ ] Confirm the library carries no text of its own: every string an operator reads still comes from
  the consumer's `src/i18n/locales/`. This is the check that stage 7's message-set cut exists for.
- [ ] `deno task ci` passes in both repositories.