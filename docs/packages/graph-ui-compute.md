# @wity/graph-ui-compute

DOM geometry, interaction bindings, and keyed diffing. Sits between `graph-headless` (pure math) and the presentation layer.

Zero framework dependencies. Zero D3. Every operation is a named function with a single responsibility.

```js
import { bindPanZoom, bindNodeDrag, keyedJoin, /* ... */ } from '@wity/graph-ui-compute';
```

---

## bindPanZoom

Binds wheel + pointer drag events to a `PanZoomState` instance, and provides programmatic animation.

```js
import { bindPanZoom } from '@wity/graph-ui-compute';

const { applyTransform, animateTo, destroy } = bindPanZoom(
  targetEl,    // Element that receives pointer events (usually the SVG root)
  viewportEl,  // <g class="kg-viewport"> — the element the transform is applied to
  panZoom,     // PanZoomState instance
  options,
);
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'svg' \| 'css'` | `'svg'` | `'svg'` writes `transform` attribute on `viewportEl`. `'css'` calls `onApplyTransform` instead |
| `onApplyTransform` | `(transformStr) => void` | — | Required in CSS mode |
| `dragTarget` | `'background' \| 'any'` | `'background'` | `'background'` requires SVG drag (default). `'any'` captures any pointer (use in CSS mode) |

### Returns

#### `applyTransform()`

Apply the current `panZoom` state to the DOM immediately. Call after any programmatic pan/zoom change.

```js
panZoom.zoomToCenter(1.5);
applyTransform();
```

#### `animateTo(targetPan, targetZoom, onComplete?, focalPoint?)`

Smooth animation: linear pan over 300ms, then ease-in quadratic zoom.

```js
// Animate to centre node 'abc'
const { x, y } = canvas.getPanTargetForNode('abc', { zoom: 1.2 });
animateTo({ x, y }, 1.2, () => console.log('done'));
```

`focalPoint` — optional `{ x, y }` screen point to keep fixed during zoom phase.

#### `destroy()`

Remove all event listeners.

---

## bindNodeDrag

Pointer-event drag with a 3px threshold. Below the threshold, pointer events pass through to node content — clicks work normally.

```js
import { bindNodeDrag } from '@wity/graph-ui-compute';

bindNodeDrag(nodeEl, {
  getData:  () => store.getNode(uid),
  onStart:  (datum, event) => { ... },
  onDrag:   ({ dx, dy, sourceEvent }, datum) => {
    const node = datum;
    store.moveNode(node.uid, node.x + dx, node.y + dy);
  },
  onEnd:    (datum, event) => { ... },
});
```

### Options

| Option | Type | Description |
|---|---|---|
| `getData` | `() => any` | Returns the datum for callbacks |
| `onStart` | `(datum, event) => void` | Called when threshold is crossed |
| `onDrag` | `({ dx, dy, sourceEvent }, datum) => void` | Delta from last position, not from start |
| `onEnd` | `(datum, event) => void` | Called on pointerup |

Uses `setPointerCapture` for clean drag ownership. Suppresses text selection during drag.

---

## bindPanZoom (pan-zoom events)

See above. Note: the `dragTarget: 'any'` mode is for CSS-transformed canvases where the SVG's `<g>` is not the element being transformed.

---

## bindContextMenu

Bind right-click events on a graph canvas. Detects whether the click hit a node or the canvas background by walking the DOM for `uid` or `vector-uid` attributes.

```js
import { bindContextMenu } from '@wity/graph-ui-compute';

const unbind = bindContextMenu(svgEl, containerEl, {
  onNodeContext:   (uid, { x, y }) => showNodeMenu(uid, x, y),
  onCanvasContext: ({ x, y })      => showCanvasMenu(x, y),
});

// Teardown
unbind();
```

Coordinates `{ x, y }` are container-relative screen coordinates.

---

## bindCursorCapture

Capture pointer position in SVG coordinate space for session logging and presence rendering.

```js
import { bindCursorCapture } from '@wity/graph-ui-compute';

const capture = bindCursorCapture(svgEl, panZoomState, {
  onMove:      ({ x, y, timestamp }) => { /* SVG-space coordinates */ },
  throttleMs:  50,   // default — 20fps
});

capture.destroy();
```

See [Actors & Sessions — Cursor capture](/guide/actors-and-sessions#cursor-capture-graph-ui-compute) for full usage including session and presence wiring.

---

## keyedJoin

Framework-agnostic keyed DOM reconciliation. Replaces D3's `.selectAll().data().join()` pattern.

```js
import { keyedJoin } from '@wity/graph-ui-compute';

keyedJoin(parentEl, '.node', nodes, {
  keyAttr:  'uid',          // data property used as the DOM key attribute (default: 'uid')
  onCreate: (el, datum) => {
    // New element — el is already inserted into parentEl
    el.innerHTML = nodeMarkup(datum);
  },
  onUpdate: (el, datum) => {
    // Existing element — update position or content
    updateNodePosition(el, datum);
  },
  onExit: (el) => {
    // Element no longer in data — animate out then remove
    el.classList.add('exit');
    setTimeout(() => el.remove(), 300);
  },
});
```

Processing order: exit → enter/update. Keys are stable by uid attribute.

---

## svgPointer

Convert client coordinates to SVG element coordinates. Replaces `d3.pointer`.

```js
import { svgPointer } from '@wity/graph-ui-compute';

svgEl.addEventListener('click', (event) => {
  const [x, y] = svgPointer(event, svgEl);
  // x, y are in svgEl's coordinate space
});
```

Uses `getScreenCTM().inverse()` for accuracy with transformed elements. Falls back to `getBoundingClientRect` for unmounted elements.

---

## SVG element operations

All SVG namespace knowledge is centralised here. The presentation layer never writes SVG namespace strings directly.

```js
import {
  ensureLayer,
  createNodeElement,    updateNodePosition,
  createEdgeElement,    updateEdgePath,
  createPortDot,        updatePortDotPosition,
  createTouchPointElement, updateTouchPointPosition,
  createPlaceholderLinkElement, updatePlaceholderLinkPath,
} from '@wity/graph-ui-compute';
```

### ensureLayer

Idempotently create or return a named `<g>` layer.

```js
const edgesLayer = ensureLayer(svgEl, 'kg-edges-layer', nodesLayer);
// Creates <g class="kg-edges-layer"> before nodesLayer if not present, otherwise returns existing
```

### Node elements (foreignObject)

```js
// Create
const el = createNodeElement(parentEl, nodeDatum, markupString, beforeEl);

// Update position only (after moveNode)
updateNodePosition(el, { x, y, w, h });
```

### Edge elements (path)

```js
const el = createEdgeElement(parentEl, edgeDatum);
// edgeDatum.path  — SVG d attribute
// edgeDatum.style — { stroke, strokeWidth, strokeDash? }

updateEdgePath(el, edgeDatum);
```

### Port dots (circle)

```js
const el = createPortDot(parentEl, portDotDatum);
// portDotDatum: { x, y, style: { color, radius } }

updatePortDotPosition(el, portDotDatum);
```

### Touch points (large invisible hit areas for port interaction)

```js
const el = createTouchPointElement(parentEl, touchPointDatum);
updateTouchPointPosition(el, touchPointDatum);
```

### Placeholder link (during drag-to-link)

```js
const el = createPlaceholderLinkElement(parentEl, placeholderDatum, pathString);
updatePlaceholderLinkPath(el, pathString);
```

---

## computePortDots

Derive render-ready port dot data from all nodes.

```js
import { computePortDots, getNodeTypeConfig } from '@wity/graph-ui-compute';

const dots = computePortDots(store.getNodes(), getNodeTypeConfig);
// → [{ nodeUid, portId, side, x, y, style: { color, radius } }, ...]
```

The second argument is the config resolver — pass `getNodeTypeConfig` from `@wity/graph-headless` (re-exported from `@wity/graph-ui-compute` so no extra import is needed).

Feed directly into `keyedJoin` + `createPortDot`/`updatePortDotPosition`.

---

## bindPortDrag

Drag-from-port gesture for drawing edges between existing nodes. Handles pointer capture, throttled move, SVG coordinate conversion, and Escape/cancel.

```js
import { bindPortDrag } from '@wity/graph-ui-compute';

const binding = bindPortDrag(portEl, viewportEl, {
  onStart:     (svgX, svgY) => linker.start(fromUid),
  onMove:      (svgX, svgY) => linker.update(svgX, svgY),
  onDrop:      (svgX, svgY) => {
    const target = getNodeAtPoint(svgX, svgY, store.getNodes(), { exclude: [fromUid] });
    linker.commit(target?.uid);
  },
  onCancel:    ()           => linker.cancel(),
  throttleMs:  16,           // optional, default 16ms (~60fps)
});

// Teardown
binding.destroy();
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `onStart` | `(svgX, svgY) => void` | — | Called on pointerdown |
| `onMove` | `(svgX, svgY) => void` | — | Called on pointermove (throttled) |
| `onDrop` | `(svgX, svgY) => void` | — | Called on pointerup |
| `onCancel` | `() => void` | — | Called on pointercancel or Escape key |
| `throttleMs` | `number` | `16` | Move event throttle interval |

`portEl` is the port dot element — stopPropagation prevents the node drag from also firing. `viewportEl` is the SVG `<g>` with the graph transform — used to convert pointer coords to SVG space.

Pair with `getNodeAtPoint` (re-exported below) to hit-test the drop target.

---

## relativeScreenPos

Compute a screen-space position relative to a container element. Useful for placing floating DOM overlays.

```js
import { relativeScreenPos } from '@wity/graph-ui-compute';

const { x, y } = relativeScreenPos(containerEl, targetEl);
// Use as CSS left/top for an overlay inside containerEl
```

Uses `getBoundingClientRect` on both elements.

---

## createToolbarRegistry

Singleton floating toolbar registry. Manages show/hide/reposition of node toolbars that float outside the SVG.

```js
import { createToolbarRegistry } from '@wity/graph-ui-compute';

const toolbar = createToolbarRegistry();

// Register a toolbar component (must expose show(data) and hide())
toolbar.register({
  id:           'action-toolbar',
  side:         'right',           // 'right' | 'top' | 'cursor'
  getComponent: () => myComponent,
  getSlot:      (nodeEl) => nodeEl.querySelector('.toolbar-slot'),
});

// Show/hide
toolbar.show('action-toolbar', nodeEl, actionData);
toolbar.hide('action-toolbar');
toolbar.hideAll();

// Call on pan/zoom to reposition open toolbars
toolbar.repositionAll();

// During drag — suppress repositioning while dragging
toolbar.beginDrag(nodeUid);
toolbar.endDrag();

toolbar.destroy();
```

**Side modes:**

| Side | Behaviour |
|---|---|
| `'right'` | Overlay top-left at slot position |
| `'top'` | Overlay bottom-left at `slot.y - overlayHeight - 8px` |
| `'cursor'` | Positioned at explicit `{ x, y }`. Does not reposition on pan/zoom — hides instead |

Cursor-mode show:
```js
toolbar.show('context-menu', { x: screenX, y: screenY }, menuData);
```

---

## Re-exports from graph-headless

`@wity/graph-ui-compute` re-exports a subset of `@wity/graph-headless` so presentation layers can import everything from a single package.

```js
import {
  getNodeAtPoint,
  getNodesInRect,
  horizontalLinkPath,
  getNodeTypeConfig,
} from '@wity/graph-ui-compute';
```

| Export | Description |
|---|---|
| `getNodeAtPoint(x, y, nodes, opts?)` | Hit-test a point against node bounding boxes. Options: `exclude: string[]`, `padding: number` |
| `getNodesInRect(rx, ry, rw, rh, nodes)` | All nodes overlapping a rectangle (rubber-band selection) |
| `horizontalLinkPath(source, target)` | Raw cubic bezier SVG `d` string between two `[x, y]` points |
| `getNodeTypeConfig(type)` | Config resolver — required as second arg to `computePortDots` |
