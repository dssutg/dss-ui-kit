# TODO

The work still to be done, in the order it should be done. A ticked box means the task is implemented
and `deno task ci` passes.

## What this repository is

`dss-ui-kit` is a component library and a design system for Preact: 88 components grouped by purpose,
71 helper modules under `src/lib/`, a 119-token CSS custom-property contract, localisation in English
and Russian with registration for any other language, a typed event bus, and a generic WebGL scene
renderer.

It was extracted from a single application, and that extraction is finished: there is no domain model,
no protocol, no data layer and no router left, and `scripts/no-domain-code.test.ts` walks the tree to
keep it that way. What remains is the work of making a working library into a published one.

## What the conventions are

Everything about how the code is written lives in [`AGENTS.md`](./AGENTS.md) — layering, the `@` import
alias, exports, types, naming, the styling contract and the commands. This file holds only the steps,
and it does not repeat them.

## What has already been done

Recorded so the remaining work is read in context rather than as an unrelated list. Each of these is in
the git history, and none of it needs redoing.

- **The toolchain**: Deno 2, Vite 8 in library mode, Tailwind CSS 3 through PostCSS declared in
  `vite.config.ts`, Biome 2 as the only formatter and linter, `tsgo` for types, Vitest, TypeDoc, and a
  GitHub Actions pipeline whose every job starts from `deno install --frozen`.
- **The separation**: the application is gone — its entrypoint, page, router, state module, protocol
  types, event names, crash-contact details and two domain components — and what remained is what more
  than one application can use.
- **The house style**: the source is formatted, `any` and non-null assertions are gone, and the four
  Biome rules that could not fit a library are turned off with the reason recorded rather than left
  implicit.
- **The public surface**: `src/index.ts` is the single entry point, every component exports its props
  interface beside it, and TypeDoc resolves from that file so the reference is the list of things a
  consumer can import.
- **The infrastructure**: the event bus keeps its mechanism and its extension point, the locale is
  registered rather than hard-coded, the theme is a `data-theme` attribute, and a library-owned store
  replaces the application state the four infrastructure modules used to read.
- **The layout**: `src/components/<group>/` and PascalCase filenames for components; `src/icons/` for
  the generated path data; `src/lib/` for hooks and helpers.

## 1. Split the themes a consumer does not need

Five themes ship in one stylesheet: `dark`, `light`, and three that exist to show the token system at
its limits — `acme`, `indigo` and `purple`. `src/css/index.css` imports all five, so every consumer
downloads all five.

- [ ] Decide whether the three extras are an example or dead weight, and record the decision. Shipping
      them as a documented example is fine; shipping them as five equally-promoted themes is not,
      because three of them are then the library's opinion rather than its contract.
- [ ] Whichever way it goes, `registerTheme` and the `data-theme` attribute already support a consumer
      bringing its own, so nothing else has to change for a fifth theme to exist.

## 2. Share the token map instead of copying it

`tailwind.config.ts` is the source of truth for the 119-token colour map, and a consuming application
has to reproduce it by hand — 119 lines that can drift from the library without anything noticing.

- [ ] Publish the token map as an importable preset (`dss-ui-kit/tailwind`) so a consumer's config is
      `presets: [uiKitPreset]` rather than a copy, and a renamed token becomes a type error there
      instead of a silent mismatch.
- [ ] The package's `exports` map and `files` list have to carry it, and `deno task pack` has to keep
      passing.

## 3. Document the public surface in prose

The API reference is generated and complete; the document a consumer reads first is not.

- [ ] A component index in [`README.md`](./README.md) grouped by purpose, with one line per component
      saying what it is for and what it deliberately does not do. The table is a starting point, not
      the document.
- [ ] A short worked example per group — a form, a table, a modal — because the props interfaces
      describe the parts and not the assembly.

## 4. Render tests

The suite is 152 tests over five pure helper modules and the five repository-policy tests. A component
that stops rendering is not a failing test today; it is a blank page in someone else's application.

- [ ] A render test per component group, driven by Preact through the compat layer, each opening with
      `// @vitest-environment jsdom`. The default environment is `node` on purpose: a suite that walks
      the filesystem or builds a URL should not be running in a DOM emulation, because it will pass
      there and fail in the runtime it ships in.
- [ ] Start with the components that carry the most logic and the least coverage: `AutoSizer`,
      `ControlledTable`, `FilterableTable`, the colour pickers and `MenuTree`.

## 5. Publish

- [ ] `CHANGELOG.md` in Keep a Changelog form. `scripts/release.ts` already derives the version from
      the history and writes the entry, so the only thing missing is the first release to write it.
- [ ] `deno task release --dry-run`, then a real release, is the maintainer's alone to run.
- [ ] The manifest is already in publishable shape: pinned versions, `sideEffects` for the stylesheet,
      Preact as a peer dependency, and `deno task pack` checking that every path in `files` exists in
      `dist/`.

## 6. Consume it from a second application

The only step that proves the other five. Until a real application builds against the package, every
item above is an assertion.

- [ ] Install the published package in an application that is not this one, pinned exactly, with the
      lockfile committed.
- [ ] Give the consumer's `tailwind.config.ts` the token set and the same Preact compatibility layer,
      so `bg-bda` and `text-tpl` resolve against the library's components.
- [ ] Move a presentational component of that application onto a library component and confirm it
      looks the same as before.
- [ ] Confirm the library carries no text of its own: every string an operator reads still comes from
      the consumer's own catalogues.
- [ ] `deno task ci` passes in both repositories.
