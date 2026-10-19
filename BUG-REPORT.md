# Bug report

Known defects and decisions still open in `src/util/`, left for another agent. Each entry names the
file and line as of this writing, says what happens against what the code says, and — where a fix is
obvious — what fixing it would want. Nothing here blocks the test suite or the coverage gate; see
the last section for the arms the coverage gate deliberately ignores.

## Defects

1. `src/util/math/vector2d.ts:188` — `normal()` computes `-this.y`, so for a vector with a zero `y`
   component the negation yields `-0`: `new Vector2D(1, 0).normal()` is `(−0, 1)`, which prints as
   such via `toString` and differs from `0` under `Object.is`. Cosmetic asymmetry; `x + 0`-style
   normalisation (`-this.y + 0` is still `-0`, so it needs `Object.is`-aware handling or `0 + -0`-safe
   arithmetic like `... * -1` on a checked value) would pin it. The suite deliberately avoids the
   degenerate input today.

2. `src/util/hooks/use_element_size/index.tsx:44` — the effect's dependency is `[elementRef.current]`,
   which is evaluated during the render pass, one turn before the ref settles: on every mount the
   first effect run observes the element with a stale `[null]` dependency and is replaced by a second
   run once the hook re-renders around its own measurement. Harmless (both runs measure the same
   element) but it makes two `ResizeObserver`s per mount and the first is always discarded. A cleanup
   that keyed on the settled element — or measuring from a ref callback — would remove the dance.
   The suite documents the shape deliberately, so a fix here should also rework those tests.

3. `src/util/rp/index.tsx:74` — `typeof x === 'string' || (typeof x === 'object' && x instanceof String)`.
   The second clause is dead: every `'object'` input returned at the `typeof x === 'object'` branch
   above (a boxed `String` included). Kept because the spelled-out test reads at a glance, but it is
   a cleanup candidate — the `if` could be `typeof x === 'string'`, together with the `v8 ignore`
   comment above it. If changed, `getPluralizationIndex`-style boolean behaviour is already covered
   by the suite and needs no new test.

## Arms the coverage gate ignores on purpose

These are not defects; they are provably unreachable defensive arms, each annotated where it sits
with a `v8 ignore` hint and a reason stating the proof. A fresh reader should not report them as
missing coverage, and should not delete the annotations without making the arm reachable or removing
the arm: `array`'s `columnWidths[j] ?? 0` pair, `color`'s `below`/`above` fallbacks, `dsv`'s bounded
index read, `svg`'s regex-group and text-node fallbacks, `html`'s reduce arm, `file`'s null target,
`use_interval`'s ref guard, `gl/renderer`'s atlas-mismatch check and text arm, `highlight`'s
walk catch (no shipped language can drive it into an error), and `pluralization`'s compiler-driven
fallbacks.

## Other issues

- src/components/tables/use_filtered_items.ts:216 — the doc says an undeclared-property term is
  "ignored rather than treated as unmatched", but `parsePart` returns `null` for it and the loop
  records it as free text, so it filters every row out.
- src/components/inputs/UploadConfig.tsx:101 — with `uploadedFile` and `progress=100` on first
  render, the status settles on `chosen`, not `complete`, because the `uploadedFile` effect
  re-renders after the progress effect and its `chosen` wins.

Fix if not fixed yet:

- TreeView.tsx:327 - a leaf's double-click reports onItemExpansionChange with
  "true" though a leaf has no expansion state to change.
- TreeView.tsx:275 - resetTypeAhead runs once before the key switch and again
  at the end of searchByTypeAhead, so a typeahead key starts two timers.
- VirtualizedList.tsx:157 - comment typo "is becase".
- tables: the search form renders an unsignedHex filter value as decimal, the
  export writes only properties hidden from the table, and empty-detection
  skips non-trim string fields.
- MiniCalendar.tsx:36 - comment grammar; a popup click reports onClose twice.
- Ripple.tsx:43 - the currentTarget cast names HTMLButtonElement although the
  listener sits on any parent element; works because only geometry is read.

- src/util/dom/web_component.ts:50 — `observedAttributes` returns the base
  class's static `props`, so a subclass redeclaring `props` observes nothing; the
  documented mechanism (redeclaring `static props`) does not fire.
- src/util/dom/web_component.ts:157 — `on()` re-binds on every re-render, so an
  attribute round trip adds a duplicate listener.
- src/util/gl/renderer.tsx:495 — a `quad` scene object is silently ignored by
  `createSceneRenderContext`, though the union and README offer it.
- src/util/gl/renderer.tsx:411 — the atlas floor uses `Math.max` against
  `MAX_TEXTURE_SIZE`, so it never shrinks to a device's smaller limit.
- src/util/hooks/use_element_size/index.tsx — the element was measured only when the ref.current value
  changed during render (stale on mount), causing an extra observer run; now tracked in state via
  layout effect so the observer effect keys off the settled element and cleans up correctly.
- src/util/hooks/use_drag_n_drop_ordered_list/index.tsx:65 — a drop before any
  dragover reports an empty order.
- src/util/array/index.tsx:78 — `getStringArrayAsColumnLines` loops forever
  with a `columnCount` of `0` and a non-empty list.
- src/util/fetch/index.tsx:103-105 — an aborted request's own `finally` clears
  the shared `loading` flag while its replacement is still in flight.
- src/util/color/index.tsx:214-215 — the destructuring fallback after the
  anchored three-group regex is unreachable defensive code.

- `src/components/feedback/AppCrashGuard.tsx:96` documents `CrashGuardProps.fallback`
    and spreads it as `fallback`, but `ErrorBoundary` reads only `fallbackComponent`,
    so a caller's custom fallback is never rendered.
- `src/components/navigation/RouteSwitch.tsx` renders `route.render(match)` and
    owns no element of its own. A `className` there would mean either wrapping the
    route's own output or changing what the route returns, and both are the
    caller's decision rather than the library's.
