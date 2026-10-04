# Worked examples

One example per component group, assembled from props that exist. The [API reference](./api-intro.md)
documents every prop; this document shows what a group is for and what it leaves to the caller, which
a signature cannot say.

Each example is written against the public surface — `import { … } from 'dss-ui-kit'` — so it is
copyable into an application that has the package installed and the token preset configured. The
`shapes` at the top of each section are the caller's own data: no type in this library names what an
application is about, so every example declares its own.

## What every example assumes

```tsx
// Every panel needs a theme; `dark` and `light` are the two the library is written against,
// and an application with its own palette registers a name and declares its tokens.
import { setTheme } from 'dss-ui-kit';

setTheme('dark');
```

Nothing in the examples calls `LocaleProvider`, because none of them needs a string the library does
not already own. A component that renders an operator-facing label of its own reads it through
`useLocale`, which falls back to English until a catalogue is registered — see the
[README](../README.md#localisation).

## buttons

**For:** a click that does one thing, styled by what the click means rather than by how it should
look.

**Not for:** anything that toggles, submits a form, or needs `disabled`. `Button` forwards no
props beyond the ones listed, because a `className` forwarded onto the element would override the
colours its `type` chose — and that choice is what the component is for. A button that toggles is
`ToggleButton`; a submit button is `Button` with `htmlButtonType="submit"`.

```tsx
import { Button, type ButtonType } from 'dss-ui-kit';

interface Device {
  readonly id: string;
  readonly name: string;
}

function DeviceActions({
  device,
  onRename,
  onRemove,
}: {
  readonly device: Device;
  readonly onRename: (device: Device) => void;
  readonly onRemove: (device: Device) => void;
}) {
  // The wording is the caller's, so these are props rather than keys the library would have to know.
  const intent = (type: ButtonType) => `${type} ${device.name}`;

  return (
    <>
      <Button type="regular" title={intent('regular')} onClick={() => onRename(device)}>
        Rename
      </Button>
      {/* `dangerous` is the caller's statement that this click is destructive. The library renders
          the colours; it has no opinion about whether the click is safe. */}
      <Button type="dangerous" title={intent('dangerous')} onClick={() => onRemove(device)}>
        Remove
      </Button>
    </>
  );
}
```

## inputs

**For:** one value, typed or chosen, with the library's field behaviour — focus ring, clear button,
password reveal — around it.

**Not for:** a form. There is no form component and no validation state: `TextInput` keeps the text
being typed so a slow render cannot drop a keystroke, and tells the caller what was typed through
`onChangeText`. What is valid is the caller's decision, because only the caller knows what the value
means.

```tsx
// `useState` comes from Preact, not from this package: the library ships its own hooks and no
// re-export of the runtime's.
import { SearchInput, Select, TextInput } from 'dss-ui-kit';
import { useState } from 'preact/hooks';

interface Filter {
  readonly text: string;
  readonly zone: string;
}

function FilterBar({ onChange }: { readonly onChange: (filter: Filter) => void }) {
  const [filter, setFilter] = useState<Filter>({ text: '', zone: 'all' });

  const update = (next: Partial<Filter>) => {
    const merged = { ...filter, ...next };
    setFilter(merged);
    onChange(merged);
  };

  return (
    <>
      <SearchInput
        value={filter.text}
        placeholder="Name"
        // `onChangeText` is the value as text, not the event: a caller that has to read
        // `event.currentTarget.value` has to get the typing behaviour right itself.
        onChangeText={(text) => update({ text })}
      />
      <Select value={filter.zone} onChange={(event) => update({ zone: event.currentTarget.value })}>
        {/* The options are the caller's; the component renders a select and its arrow. */}
        <option value="all">All</option>
        <option value="north">North</option>
      </Select>
      <TextInput
        placeholder="Free text"
        onChangeText={(text) => update({ text })}
        onClearClick={() => update({ text: '' })}
      />
    </>
  );
}
```

## tables

**For:** showing a list the caller already holds, filtered and sorted through data the caller
describes.

**Not for:** fetching, paging, or deciding what an item is. The table takes `items` and a property
list; each property carries its own comparator, its own cell renderer and its own search extractor.
`FilterableTable` holds the search text itself, `ControlledTable` takes it as a prop so it can live in
a URL — the two differ in exactly that, and the rest is identical.

```tsx
import { ControlledTable, type FilterableTablePropertyList } from 'dss-ui-kit';

interface Device {
  readonly id: string;
  readonly name: string;
  readonly online: boolean;
}

type ColumnId = 'name' | 'online';

// The properties are a list rather than a record because their order is the order the columns are
// drawn in.
const properties: FilterableTablePropertyList<Device, ColumnId> = [
  {
    id: 'name',
    title: 'Name',
    width: 240,
    minWidth: 80,
    cell: ({ data }) => <span>{data.name}</span>,
    comparator: (a, b) => a.data.name.localeCompare(b.data.name),
    // `search` is how the table's own search box filters: the caller says what a row's text is,
    // rather than the table reflecting over the object and guessing.
    search: { type: 'string', extractValue: (device) => device.name },
  },
  {
    id: 'online',
    title: 'Online',
    width: 100,
    minWidth: 60,
    cell: ({ data }) => <span>{data.online ? 'Yes' : 'No'}</span>,
    comparator: (a, b) => Number(a.data.online) - Number(b.data.online),
    // An enum search filters by a closed set of values, and a value in the data that is missing from
    // `options` still renders — labelled with the value itself — until the caller lists it.
    search: {
      type: 'enum',
      options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
      extractValue: (device) => String(device.online),
    },
  },
];

function DeviceTable({ devices }: { readonly devices: Device[] }) {
  // `ControlledTable` holds nothing itself, so the search string is the caller's state and may live
  // in a URL rather than in React.
  const [searchText, setSearchText] = useState('');

  return (
    <ControlledTable
      items={devices}
      properties={properties}
      searchText={searchText}
      setSearchText={setSearchText}
      // The caller's wording for "rows", because the word belongs to what is being counted.
      countLabelPrefix="Devices"
      minCountLabelWidth="10rem"
      headerRowHeight={30}
      rowHeight={30}
      getExportedTableFilename={() => 'devices.csv'}
      sortColumnId="name"
      getItemId={(device) => device.id}
    />
  );
}
```

## overlays

**For:** something above the page, with the escape key, the backdrop and the focus handling already
decided.

**Not for:** a confirm dialog. `Modal` reports `onOpenChange(false)` and lets the caller decide
whether the close is allowed — it does not hold a question, because that would mean the library
naming the decision. The close is deferred by the length of the opening animation, so a dialog that
closed instantly would flash rather than fade; the panel stays unfocusable until that animation has
run, so an invisible dialog cannot be clicked.

`ConfirmationModal` is the dialog that does hold the question. It reports the two answers as two
callbacks, treats everything that dismisses it without answering — the backdrop, Escape, the close
button — as a cancel, and answers once however many times the button is clicked.

```tsx
import { Button, Modal } from 'dss-ui-kit';
import { useState } from 'preact/hooks';

function DeviceDialog({
  device,
  onClose,
}: {
  readonly device: Device;
  readonly onClose: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Button title="Open" onClick={() => setOpen(true)}>
        Details
      </Button>
      <Modal
        open={open}
        title={device.name}
        // The caller decides what closing means, so a form with unsaved changes can refuse it here.
        onOpenChange={(next) => (next ? setOpen(true) : onClose())}
      >
        <p>Anything the caller wants to put in the dialog.</p>
      </Modal>
    </>
  );
}
```

```tsx
import { Button, ConfirmationModal } from 'dss-ui-kit';
import { useState } from 'preact/hooks';

function DeleteAllLogs({ onDeleted }: { readonly onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button type="dangerous" title="Delete all logs" onClick={() => setConfirming(true)} />
      <ConfirmationModal
        open={confirming}
        title="Delete every log file?"
        message="The logs cannot be read after they are deleted."
        // What the answer leads to is the caller's: the dialog asks, it does not decide.
        onConfirm={() => {
          onDeleted();
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
        destructive
      />
    </>
  );
}
```

`Popover`, `DropDownMenu` and `FeedbackTooltip` are the other three: a popover that renders its panel
in the tree while closed so it can be measured, a menu that reports the item it was given rather than
holding the choice, and a tooltip that stays in the tree but out of the accessibility tree while
hidden.

## navigation

**For:** a structure the caller holds — a selection, an expansion, an order — drawn from it.

**Not for:** navigating. There is no router here: `Link` renders an `<a href>` and reports
`onNavigate`, so the URL is the application's. A menu that navigated on the library's say-so could not
be put in a page that routes somewhere else. What a path *means* is here, though — `matchPath`,
`dispatchPathMap` and `RouteSwitch` read a path the caller holds and say what it addresses, and none of
them touches the location or the history.

```tsx
import { Accordion, MenuTree, type TMenuTreeItem } from 'dss-ui-kit';
import { useState } from 'preact/hooks';

interface Node {
  readonly id: string;
  readonly label: string;
  readonly children: Node[];
}

/** `TMenuTreeItem` is the shape every level of the menu has, so one entry per node and its children. */
const toMenuItems = (nodes: Node[], depth: number): TMenuTreeItem[] =>
  nodes.map((node) => ({
    id: node.id,
    title: node.label,
    subitems: toMenuItems(node.children, depth + 1),
  }));

/**
 * The tree indents an item by the depth the caller reports for it, and it cannot walk into the
 * caller's data to find that out, so the sidebar records the depth of every id while it builds the
 * menu and reads it back here.
 */
const depthsOf = (nodes: Node[]): Map<string, number> => {
  const depths = new Map<string, number>();

  const walk = (level: Node[], depth: number) => {
    for (const node of level) {
      depths.set(node.id, depth);
      walk(node.children, depth + 1);
    }
  };

  walk(nodes, 0);
  return depths;
};

function Sidebar({
  nodes,
  selectedId,
  onSelect,
}: {
  readonly nodes: Node[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const menuItems = toMenuItems(nodes, 0);
  const depths = depthsOf(nodes);

  return (
    <>
      <MenuTree
        expanded={expandedId !== null}
        width={240}
        menuItems={menuItems}
        currentItemId={selectedId}
        getMenuItemDepth={(menuItem) => depths.get(menuItem.id) ?? 0}
        onItemClick={({ menuItem }) => {
          onSelect(menuItem.id);
          // 'deny' leaves the tree's own handling alone, which is what an item that routes wants.
          return 'deny';
        }}
        onMenuExpansionChange={(next) => setExpandedId(next ? selectedId : null)}
      />
      <Accordion
        expanded
        onExpansionChange={() => undefined}
        triggerTitle="Details"
        // Whatever the caller wants revealed. The accordion does not fetch it.
      >
        <p>Caller-supplied content.</p>
      </Accordion>
    </>
  );
}
```

The same tree, addressed by path instead of by a selected id — the pattern a router-driven sidebar
uses, where the menu item's `id` *is* the path it points at:

```tsx
import { MenuTree, RouteSwitch, getPathDepth, type TMenuTreeItem } from 'dss-ui-kit';

function RoutingSidebar({ path }: { readonly path: string }) {
  return (
    <MenuTree
      expanded
      width={240}
      menuItems={menuItemsByPath}
      currentItemId={path}
      // A path's depth is one more than the level of the item it addresses, because it is counted
      // from the separator in front of the first component.
      getMenuItemDepth={(menuItem) => getPathDepth(menuItem.id) - 1}
      onItemClick={() => 'default'}
      onNavigate={(path) => history.pushState(null, '', path)}
    />
  );
}

function RoutedPage({ path }: { readonly path: string }) {
  return (
    <RouteSwitch
      path={path}
      routes={[
        // Only the route that matches is built, so a page that reads state on construction is not
        // constructed for a path it is not on.
        { path: '/serverRack/:rackId', render: (match) => <RackPage rackId={getPathParam(match, 'rackId') ?? ''} /> },
        // The fallback is an ordinary entry: the path '*' matches whatever is left.
        { path: '*', render: () => <p>No such page</p> },
      ]}
    />
  );
}
```

A menu that slides in from the edge, over a bar that names where the caller is:

```tsx
import {
  buildMenuItemFullTitleByItsId,
  MenuTree,
  NavBar,
  SlideMenu,
  type TMenuTreeItem,
} from 'dss-ui-kit';

function ApplicationShell({ path, menuItems }: { readonly path: string; readonly menuItems: TMenuTreeItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <NavBar
        rootTitle="Server room"
        // The bar renders the title; it does not fetch it, and it does not know what a menu item is
        // called until the caller reads it out of the menu.
        breadcrumb={buildMenuItemFullTitleByItsId(menuItems, path) ?? []}
        onMenuClick={() => setMenuOpen(true)}
      >
        <Clock />
      </NavBar>

      <SlideMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        // 3rem is the height of the bar above, which only this caller knows.
        topOffset="3rem"
        panelClassName="text-pl"
      >
        <MenuTree
          expanded
          width="100%"
          menuItems={menuItems}
          currentItemId={path}
          getMenuItemDepth={(menuItem) => getPathDepth(menuItem.id) - 1}
          onItemClick={({ menuItem }) => {
            // Navigating closes the menu; the route itself is the application's.
            onNavigate(menuItem.id);
            setMenuOpen(false);
            return 'deny';
          }}
        />
      </SlideMenu>
    </>
  );
}
```

The panel is portalled onto the body and is in the document the whole time, because a drag from the
edge of the viewport opens it. A caller that wants it closed by a key press, or by anything else, adds
that itself — `open` is the caller's, and the drag reports through `onOpenChange` rather than
deciding.

## display

**For:** showing something the caller has — an icon, a link, a value — in the design system's shape.

**Not for:** serialising the value. `HighlightedJson` takes JSON text and highlights it; whether an
object becomes text at all, and which of its fields an operator should see in it, is the caller's
decision, so the caller makes it and hands over the result. `LightRayOverlay` draws an image the caller
bundled; the library ships no picture of its own, because an asset is the application's.

```tsx
import { HighlightedJson, Icon, IconedSectionTitle, Link } from 'dss-ui-kit';

function DeviceSummary({ device }: { readonly device: Device }) {
  return (
    <section>
      <IconedSectionTitle title="Device" icon="grid" />
      {/* `invisible` keeps an icon's space reserved while it is waiting for its data. */}
      <Icon name="grid" invisible={!device.online} />
      {/* `to` is rendered as the href; `onNavigate` is for a router that owns navigation. */}
      <Link to={`/devices/${device.id}`} onNavigate={() => undefined}>
        {device.name}
      </Link>
      {/* The caller serialises, because what an operator should see in a panel is its decision. */}
      <HighlightedJson json={JSON.stringify(device, null, 2)} />
    </section>
  );
}
```

### Decoration across the viewport

`LightRayOverlay` is a wash of light behind everything, drawn with an image the caller hands it. It takes
no clicks and is hidden from the accessibility tree; how bright it is is a default that `className`
overrides, so a caller who wants it stronger does not have to edit the component.

```tsx
import { LightRayOverlay } from 'dss-ui-kit';
import rayImage from './ray.png';

function DeviceScreen({ children }: { readonly children: ReactNode }) {
  return (
    <div className="relative">
      {/* Behind the panel and out of the way of it: `pointer-events-none` is what keeps the panel clickable. */}
      <LightRayOverlay image={rayImage} className="opacity-70" />
      <div className="relative">{children}</div>
    </div>
  );
}
```

## feedback

**For:** telling an operator that something is happening, or that it went wrong.

**Not for:** deciding what went wrong. `AppCrashGuard` catches an error the caller did not handle and
renders a fallback it was given; the message, the retry and the report are the caller's, because the
library cannot know whether a failure is worth retrying or who should be told.

```tsx
import { AppCrashGuard, type CrashReport, LogWidget, Spinner } from 'dss-ui-kit';
import type { ReactNode } from 'preact/compat';

interface PanelProps {
  readonly version: string;
  readonly loading: boolean;
  readonly lines: readonly string[];
  readonly children: ReactNode;
}

/**
 * The fallback is a component rather than an element, so the guard can render it after its own first
 * effect has run and the report exists.
 */
function CrashFallback({
  error,
  report,
}: {
  readonly error: Error;
  readonly report: CrashReport | null;
}) {
  // The guard catches the error and renders the shell; what it says is the caller's sentence, and the
  // report is the caller's to submit through `onCrash`.
  return (
    <section>
      <h1>Something went wrong</h1>
      <p>{report?.errorMessage ?? error.message}</p>
    </section>
  );
}

function Panel({ version, loading, lines, children }: PanelProps) {
  if (loading) {
    return <Spinner />;
  }

  return (
    <>
      {/* `LogWidget` is the caller's window onto its own output: the text, and whether it is live. */}
      <LogWidget
        title="Output"
        playing
        output={lines.join('\n')}
        onPlayClick={() => undefined}
        onPauseClick={() => undefined}
        onClearClick={() => undefined}
      />
      {/* `version` goes into every report, so it is a prop rather than something read out of a global. */}
      <AppCrashGuard version={version} fallback={CrashFallback}>
        {children}
      </AppCrashGuard>
    </>
  );
}
```

### A command console

`CommandConsole` is a prompt, a history and the two commands a shell cannot do without: `help`, which
lists what the caller registered, and `clear`. The commands are the caller's — the console holds no
vocabulary of its own, so it is built in the caller's component and closes over that component's state.

```tsx
import { CommandConsole, type CommandConsoleCommand } from 'dss-ui-kit';
import { useMemo, useState } from 'react';

function ConsolePanel({ developerMode }: { readonly developerMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [threshold, setThreshold] = useState(80);

  const commands = useMemo<Readonly<Record<string, CommandConsoleCommand>>>(
    () => ({
      threshold: {
        about: 'Show or change the threshold',
        // A function where the usage line has to read under the name it was called by.
        usage: ({ commandName }) => [`${commandName}`, `${commandName} <percent>`],
        execute: ({ args, echo }) => {
          const value = args[1];

          if (value === undefined) {
            echo(`threshold is ${threshold}`);
            return;
          }

          const percent = Number(value);

          // A command validates its own arguments: the console does not know what a percent is.
          if (Number.isNaN(percent)) {
            echo('not a number');
            return;
          }

          setThreshold(percent);
          echo(`threshold is now ${percent}`);
        },
      },
      dump: {
        about: 'Print the raw frame, for a developer',
        requiresDeveloper: true,
        execute: ({ echo }) => {
          echo('frame 4a2f');
        },
      },
    }),
    [threshold],
  );

  return (
    <>
      {/* Which key opens the console is the application's decision, so the button is the caller's. */}
      <button type="button" onClick={() => setOpen(true)}>
        Open the console
      </button>
      <CommandConsole
        open={open}
        onOpenChange={setOpen}
        commands={commands}
        developerMode={developerMode}
      />
    </>
  );
}
```

**Not for:** the vocabulary of an application. A console that shipped its own commands would have to know
what the application is about, so every command is the caller's; a command that changes application state
is a closure over that state. The two built-ins are replaced by name if the caller wants a command called
`help` or `clear` to mean something else.

## layout

**For:** giving a child the size it was given, and a splitter that remembers where it was put.

**Not for:** a grid. `AutoSizer` measures its box and hands the size to a render function, because a
chart or a canvas cannot be laid out by CSS alone; `ResizableSplit` gives panels fractions of itself
and remembers the divider in `localStorage`. Neither of them arranges more than one child — a page
with three regions is three components in the caller's own markup.

```tsx
import { AutoSizer, ResizableSplit, SimpleLineChart } from 'dss-ui-kit';

function SplitView({ points }: { readonly points: number[] }) {
  return (
    <ResizableSplit
      orientation="horizontal"
      panels={[
        {
          id: 'chart',
          component: (
            <AutoSizer>
              {({ width, height }) => <SimpleLineChart yPoints={points} style={{ width, height }} />}
            </AutoSizer>
          ),
          minSize: 20,
        },
        { id: 'details', component: <p>Details</p> },
      ]}
    />
  );
}
```

## charts

**For:** drawing numbers the caller holds.

**Not for:** deciding what the numbers mean, or sampling them. `SimpleLineChart` draws the points it
is given at one pixel per point: what to drop from a signal is a decision about the signal, so the
caller reduces it before it arrives. The calendar components draw a month from a `Date` and hold no
selection of their own.

```tsx
import { PieChart, RingProgress, mapToShares } from 'dss-ui-kit';

function Usage({
  counts,
}: {
  readonly counts: readonly { readonly label: string; readonly count: number }[];
}) {
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <>
      <PieChart shares={mapToShares(counts, total, (entry) => ({
        title: entry.label,
        count: entry.count,
      }))} radius={80} />
      {/* The ring is a stroke, not a spinner: an operator can read the fraction off it. */}
      <RingProgress progress={total} progressMax={100} title={`${total}%`} />
    </>
  );
}
```

## color-picker

**For:** a colour, in the notation the caller already holds.

**Not for:** converting between notations. `HexColorPicker` reports `#rrggbb`, `HslaStringColorPicker`
reports `hsla(...)`, and each is built from one `ColorModel`. A caller that needs to move between them
uses the exported conversion helpers — the picker never changes the notation it was given, because a
picker that did would report a colour the caller's model cannot represent.

```tsx
import { HexAlphaColorPickerPopover, HexColorPicker } from 'dss-ui-kit';

function ColorField({
  color,
  onChange,
}: {
  readonly color: string;
  readonly onChange: (color: string) => void;
}) {
  return (
    <>
      <HexColorPicker color={color} onChange={onChange} />
      {/* The popover variant reports the change a short debounce after the last one: a drag fires a
          change per pointer move, and a caller that re-rendered a panel per change could not drag at
          all. */}
      <HexAlphaColorPickerPopover
        trigger={<button type="button">Pick</button>}
        color={color}
        onChange={onChange}
      />
    </>
  );
}
```