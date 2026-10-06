# DSS UI Kit

A component library and design system for Preact: components, the hooks they need, a CSS
custom-property token contract, localisation, an event bus, and a generic WebGL scene
renderer.

Nothing here knows what application it is rendered in. There is no model of what an application is
about, no data layer and no router: a component takes props, and anything a caller would otherwise
have to reach into their own code for is a prop.

## Contents

- [Install](#install)
- [Use](#use)
- [Styling](#styling)
- [Localisation](#localisation)
- [Theming](#theming)
- [Events](#events)
- [WebGL](#webgl)
- [Development](#development)
- [Licence](#licence)

## Install

From npm:

```sh
deno add npm:dss-ui-kit npm:preact
```

From JSR (the TypeScript source, not a bundle):

```sh
deno add jsr:@dssutg/dss-ui-kit
```

Preact is a peer dependency, so the library runs on the Preact your application already has. The
code is
written against the React API and bundled with `preact/compat`, so `react`, `react-dom` and
`react-dom/client` all resolve to Preact inside this package. The JSR package relies on the same
aliasing: a Deno consumer needs

```json
// deno.json
{ "imports": { "react": "npm:preact@^10.19.0/compat" } }
```

or the equivalent, since the source names `react` and JSR does not rewrite it — the imports map of
the publish resolves it for the Deno checker, and a bundler consumer maps it as they do for npm
(`react` → `preact/compat`).

## Use

The package root is the entire public surface, and every export is named:

```tsx
import { Button, ControlledTable, LocaleProvider, setTheme } from 'dss-ui-kit';
import 'dss-ui-kit/style.css';
```

A module that is not reachable from the root is not part of the library. Importing past it means
depending on something the version number does not describe.

### Components

| Group                                   | What is in it                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `buttons`                               | `Button`, `ButtonGroup`, `DropDownButton`, `IconButton`, `ToggleButton`, `PlayPauseButton`, …    |
| `charts`                                | `Chart`, `PieChart`, `RingProgress`, `SimpleLineChart`, `ZoomableCanvas`, `MiniCalendar`, …      |
| `color-picker`                          | Hex, RGB, RGBA, HSLA, HSL and RGBA-string pickers and inputs, with or without an alpha channel    |
| `display`                               | `Icon`, `Link`, `HighlightedJson`, `IconViewer`, `IconedSectionTitle`                            |
| `feedback`                              | `Spinner`, `Ripple`, `LogWidget`, `ScrollProgressBar`, `AppCrashGuard`, …                        |
| `inputs`                                | `TextInput`, `SearchInput`, `Select`, `Slider`, `ToggleSwitch`, `JsonEditor`, `VirtualizedList`, … |
| `layout`                                | `AutoSizer`, `ResizableSplit`                                                                    |
| `navigation`                            | `Accordion`, `MenuTree`, `TreeView`, `OrderPanel`, `MUITabList`, …                                |
| `overlays`                              | `Modal`, `Popover`, `DropDownMenu`, `FeedbackTooltip`                                             |
| `tables`                                | `ControlledTable`, `FilterableTable`, `SortableTable`, `GeneralizedSearchModal`, …                |

Every component exports its props interface beside it (`ButtonProps`, `AutoSizerProps`, …), and every
one of those props interfaces is documented in the [API reference](./docs/api-intro.md).

The table is an index, not the documentation: it says which group a component is in. What a component
is for, and what it deliberately leaves to its caller, is in
[worked examples](./docs/examples.md) — one per group, assembled from props that exist.

## Styling

The design system is a set of CSS custom properties named `--color-*`, defined per theme and
exposed as Tailwind colour utilities — `bg-bda`, `text-bdat`, `border-tpl`, `fill-tok`. A theme is
data, not a
build artefact: switching theme sets a `data-theme` attribute on `<body>` and nothing recompiles.

A consuming application has to do two things for the components to look right: scan the published
package so Tailwind can see the class names the components render, and use the token map, because a
utility only exists in the output if the config names the token. The map is published as a preset, so
it is a dependency rather than a file to copy:

```ts
// tailwind.config.ts in the consuming application
import forms from '@tailwindcss/forms';
import { uiKitPreset } from 'dss-ui-kit/tailwind';
import type { Config } from 'tailwindcss';

export default {
  presets: [uiKitPreset],
  // The package is scanned as well as the application, or a class the library renders is
  // never generated and the component is unstyled. The preset does not carry `content`:
  // a path written in this repository would be resolved against whatever directory the
  // build that reads the config happens to run in.
  content: ['./src/**/*.{ts,tsx}', './node_modules/dss-ui-kit/dist/**/*.{js,cjs}'],
  // The class strategy only: the base strategy restyles every input, select and checkbox the
  // browser renders and puts a blue focus ring on them, and this library styles its own controls.
  plugins: [forms({ strategy: 'class' })],
} satisfies Config;
```

`uiKitPreset` names each token the way the custom property is named, so `bg-bda` is
`var(--color-bda)` in the output and the two cannot drift apart. A renamed token is a type error in
this file rather than a class that silently stops resolving.

Renaming a custom property is a breaking change. Adding one is not.

## Localisation

The library ships English and Russian, both complete, and can be given any other language. A missing
translation is a type error rather than a blank label on a panel an operator is reading.

```tsx
import { LocaleProvider, registerLocale, type LocaleDefinition } from 'dss-ui-kit';

// A key the application owns is declared once, here or in its own types module. Every `t` call is
// checked against the library's keys and these together.
declare module 'dss-ui-kit' {
  interface CustomMessages {
    'app.title': string;
  }
}

registerLocale('de', {
  messages: { 'button.cancel': 'Abbrechen', 'app.title': 'Betriebskonsole' },
  script: 'latin',
} satisfies LocaleDefinition);

// Or pass messages and dates straight to the provider, without registering a locale first.
<LocaleProvider initialLocale="de" messages={{ de: { 'button.cancel': 'Abbrechen' } }}>
  {children}
</LocaleProvider>;
```

`MessageKey` is derived from the English catalogue, so a key has to exist before a component can name
it, and `t` takes a declared key: one of `MessageKey`, or one the consumer added by augmenting
`CustomMessages` as above. An undeclared key does not compile, so a typo is caught at the desk rather
than read off a panel by an operator. `tRaw` takes any string, for a key built at runtime or
read out of data, and catalogues passed to `registerLocale` or the `messages` prop are checked the
same way — `DeclaredCatalogue`, where every key must be declared.

## Theming

Themes ship with the library, and more can be registered with `registerTheme`. Two of them are the
library's contract and the rest are published examples:

| Theme | What it is |
| --- | --- |
| `dark`, `light` | The two the library is written and tested against. Both define every token. |
| `acme`, `indigo`, `purple` | Worked examples of a **partial** theme: each overrides a handful of tokens and inherits the rest from `dark`. |

A theme's custom properties are the consumer's CSS, not a JavaScript object: `registerTheme` only
tells the library a name is real — it takes the name and the swatch a picker shows for it — and the
tokens themselves are declared in the consumer's stylesheet, under the `data-theme` attribute the
library writes. `themes/acme.css` is the shortest way to see the shape of that block, because it is
the worked example: a handful of `--color-*` overrides, and the rest inherited.

```ts
import { registerTheme } from 'dss-ui-kit';

registerTheme({ name: 'house', tileColor: '#5b8a72' });
```

```css
/* The consumer's own stylesheet: the tokens `house` changes, and only those. */
body[data-theme='house'] {
  --color-bpl: #101014;
  --color-tpl: #e6e6ec;
}
```

`setTheme` writes the theme name to a `data-theme` attribute on `<body>` and remembers the choice;
`useTheme` reads it back and re-renders when it changes, including when another tab changes it:

```tsx
import { setTheme, useTheme } from 'dss-ui-kit';

setTheme('dark');
const theme = useTheme();
```

## Events

The event bus is typed and open at both ends. A consumer declares its own events by augmenting
`EventTypes`, and gets both directions checked:

```ts
import { emitTypedEvent, useTypedEvent } from 'dss-ui-kit';

declare module 'dss-ui-kit' {
  interface EventTypes {
    CART_CHANGED: { itemCount: number };
  }
}

emitTypedEvent('CART_CHANGED', { itemCount: 3 });
```

`emitEvent` / `useEvent` are there for a name that is not declared.

## WebGL

`src/util/gl` is a small scene renderer over a raw WebGL context: boxes, quads, text sprites and camera
projection, with per-face colours or a flat material. It is generic — it has no model of anything —
and it is exported in full (`createSceneRenderContext`, `renderScene`, `useGLCtx`,
`convertBoxToQuads`, `generateTransformMatrices`, …) for an application that needs to draw its own
scene in the same pipeline the components use.

## Development

Deno 2 drives everything; there is no npm or yarn step.

```sh
deno install            # install or refresh dependencies
deno task dev           # dev server
deno task build         # production build into dist/
deno task lint          # biome ci + markdownlint + typecheck
deno task format        # biome check --write (apply safe fixes)
deno task typecheck     # tsgo only
deno task test          # unit tests
deno task docs          # TypeDoc API reference into docs/api/
deno task icons         # regenerate src/icons/index.tsx from the source SVGs
deno task codemod       # run a codemod for a mechanical multi-file rewrite
deno task publish:dry   # what a JSR publish of the current tree would carry
deno task publish       # publish the TypeScript source to jsr.io/@dssutg/dss-ui-kit
deno task ci            # the full local gate, exactly what CI runs
```

`deno task ci` is the gate: a green pipeline and a green `deno task ci` mean the same thing.

The rules the code is held to — layering, the `@` import alias, the naming conventions, the no-`any`
and no-non-null-assertion bans — are in [`AGENTS.md`](./AGENTS.md).

## Licence

MIT — see [`LICENSE`](./LICENSE).
