# ZoomableCanvas defect report

Defects in `src/components/charts/ZoomableCanvas.tsx`.

## Issue 1 — no repaint when asynchronous content arrives (confirmed)

**Observed.** A canvas showing content that resolves asynchronously keeps its last frame until the
operator pans, zooms or resizes. In the floor-plan viewer: opening a plan whose image is still
loading leaves the canvas fully transparent — zero painted pixels — and the same holds for a TCO
icon that lands in its cache after the first draw.

**Mechanism.** All drawing runs through one granular effect whose dependency array is

```text
width, height, transform, startDistance, onTransformChange, drawCallback,
minScale, maxScale, scaleFactor, isDragging, canvasRef, onClickAt,
onCanvasDragStart, onCanvasDragEnd, onMouseMoveNoDragging,
onSingleTouchMove, shouldReleaseDragOnMouseLeave, startX, startY
```

A state change that only re-renders — the resolved `HTMLImageElement`, an icon entering a cache —
changes no identity in that array, so the effect never re-runs and `draw()` is never called. The
component has no imperative redraw hook and no content-version prop: there is no supported way to
say "the scene changed, paint again" without also changing the view.

**Evidence.**

When drawn content (like asynchronously loaded images) changes without changing the view state,
the canvas does not repaint because draw() only runs when dependencies of the granular effect change.

**Expected.** The canvas paints whenever the drawn content changes — an imperative redraw API, a
content-nonce prop in the watched deps, or draw() should be callable to refresh the canvas.

## Issue 2 — every pointer start re-registers all listeners (suspected, intermittent)

**Observed once.** During the authoring flow a third consecutive canvas click, in quick succession,
never reached the element being drafted; the draft stayed at two vertices. It has not reproduced
since a debug `console.log` was removed from the click path.

**Mechanism.** `isDragging`, `startX` and `startY` sit in the same dependency array as the drawing
and the event registration, so every pointer start tears down and re-adds canvas listeners and document
listeners. A rapid follow-on press that falls between teardown and re-registration can be lost.

**TODO.** Split the listener registration effect from the drawing effect so that listener setup/teardown
does not depend on transient drag state values that change frequently. Dragging state should be tracked
via refs where it does not need to retrigger listener registration.
