# DSS UI Kit

A domain-independent component library and design system for Preact: **88 components**, the hooks they
need, a **119-token** CSS custom-property contract, localisation, an event bus, and a generic WebGL
scene renderer.

Nothing here knows what application it is rendered in. There is no domain model, no data layer and no
router: a component takes props, and anything a caller would otherwise have to reach into their own
application for is a prop.

## Install

```sh
deno add npm:dss-ui-kit npm:preact
```

Preact is a peer dependency, so the library runs on the Preact your application already has. The code is
written against the React API and bundled with `preact/compat`, so `react`, `react-dom` and
`react-dom/client` all resolve to Preact inside this package.

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

## Styling

The design system is **119 CSS custom properties** named `--color-*`, defined per theme and exposed as
Tailwind colour utilities — `bg-bda`, `text-bdat`, `border-tpl`, `fill-tok`. A theme is data, not a
build artefact: switching theme sets a `data-theme` attribute on `<body>` and nothing recompiles.

A consuming application has to do two things for the components to look right: scan the published
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

The library's own `tailwind.config.ts` is the source of truth for that map.

Renaming a custom property is a breaking change. Adding one is not.

## Localisation

The library ships English and Russian, both complete, and can be given any other language. A missing
translation is a type error rather than a blank label on a panel an operator is reading.

```tsx
import { LocaleProvider, registerLocale, type LocaleDefinition } from 'dss-ui-kit';

registerLocale('de', {
  messages: { 'button.cancel': 'Abbrechen' },
  script: 'latin',
} satisfies LocaleDefinition);

// Or pass messages and dates straight to the provider, without registering a locale first.
<LocaleProvider initialLocale="de" messages={{ de: { 'button.cancel': 'Abbrechen' } }}>
  {children}
</LocaleProvider>;
```

`MessageKey` is derived from the English catalogue, so a key has to exist before a component can name
it, and every other catalogue is typed `Record<MessageKey, string>`. A consumer adds its own keys by
passing `messages` to the provider.

## Theming

Five themes ship — `dark`, `light`, `acme`, `indigo` and `purple` — and more can be registered with
`registerTheme`. `setTheme` writes the theme name to a `data-theme` attribute on `<body>` and remembers
the choice; `useTheme` reads it back and re-renders when it changes, including when another tab changes
it:

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

`src/lib/gl` is a small scene renderer over a raw WebGL context: boxes, quads, text sprites and camera
projection, with per-face colours or a flat material. It is generic — it has no model of anything —
and it is exported in full (`createSceneRenderContext`, `renderScene`, `useGLCtx`,
`convertBoxToQuads`, `generateTransformMatrices`, …) for an application that needs to draw its own
scene in the same pipeline the components use.

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

The rules the code is held to — layering, the `@` import alias, the naming conventions, the no-`any`
and no-non-null-assertion bans — are in [`AGENTS.md`](./AGENTS.md).

## Licence

MIT — see [`LICENSE`](./LICENSE).
