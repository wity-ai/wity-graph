# @wity/graph-headless

Pure state, layout, traversal, geometry, and ontology. No DOM, no framework, zero dependencies.

```js
import { GraphStore, SelectionManager, /* ... */ } from '@wity/graph-headless';
```

---

## GraphStore

The central state container. Extends `EventBus`. Owns all node and edge data, drives layout, and emits events.

### Constructor

```js
const store = new GraphStore(options);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `viewport` | `{ width, height }` | `{ width: 800, height: 600 }` | Canvas dimensions — used to centre the root node during layout |
| `defaultActions` | `object[]` | `[]` | Graph-level fallback actions when a node has no `availableActions` |
| `defaultStyleConfig` | `object[]` | `[]` | Graph-level fallback style config |

### Node data schema

Fields recognised by GraphStore. All are optional except `uid` (auto-generated if absent).

```js
{
  // Identity
  uid:          string,       // unique identifier; auto-generated if absent
  pubKey:       string,       // temp client uid for deduplication (see addNode)
  type:         string,       // node type: 'continuant' | 'occurant' | custom
  variant:      string,       // UI extension point, carried opaquely

  // Content
  title:        string,
  content:      string,       // also accepts msg alias
  message:      string,       // also accepts rawMsg alias

  // Display
  styleClass:   string,       // CSS class on the node wrapper
  styleObj:     object,       // per-node committed visual overrides — write via setNodeStyle()
  availableStyleConfig: object[],  // overrides graph default style config
  showStylePanel: boolean,    // default true; false suppresses style overlay

  // Behaviour
  links:        { targetUid, type? }[],  // edges to build on ingest
  tags:         string[],
  status:       string,       // occurant lifecycle status
  availableActions:   object[],    // per-node toolbar actions
  contextMenuActions: object[],    // per-node context menu actions

  // Temporal (for graph-player)
  createdAt:    number,       // epoch ms
  startedAt:    number,       // epoch ms
  completedAt:  number,       // epoch ms
  erroredAt:    number,       // epoch ms
  cancelledAt:  number,       // epoch ms

  // Actor attribution (carried opaquely)
  createdBy:    string,       // actorId — single, immutable once set
  updatedBy:    string[],     // actorIds — contributors list, append-only by convention
}
```

### Node CRUD

#### `addNode(data)` → `node`

Add or upsert a node. Handles `pubKey` deduplication — if a temp node with `uid === data.pubKey` exists, it is swapped out for the real uid while preserving position state.

```js
const node = store.addNode({
  uid:   'concept-1',
  type:  'continuant',
  title: 'My concept',
  createdBy: 'user-1',
});
```

#### `updateNode(uid, data)` → `node | null`

Partial update. Does not reset layout state unless `_computedInitialProps` is explicitly passed.

```js
store.updateNode('concept-1', { title: 'Updated title', updatedBy: ['user-1', 'user-2'] });
```

#### `removeNode(uid)`

Removes a node and all its connected edges. Emits `'node:removed'` with `{ uid, descendants: node[] }` **before** deletion — use this for exit animations.

#### `removeNodes(uids)`

Remove multiple nodes in a single batch. More efficient than calling `removeNode()` in a loop — emits one `'nodes:removed'` event before deletion and coalesces `'nodes:changed'` + `'edges:changed'` into single emissions.

The caller decides the scope — pass descendants explicitly using `getDescendants()` if deleting a branch.

```js
// Delete a single branch
const descendants = store.getDescendants(uid);
store.removeNodes([uid, ...descendants.map(d => d.uid)]);

// Listen for bulk removal
store.on('nodes:removed', ({ uids, nodes }) => animateExits(nodes));
```

`SelectionManager` auto-deselects all removed nodes and emits one `'selection:changed'` — no extra wiring needed.

#### `getNode(uid)` → `node | null`

Returns a **direct reference** to the internal node object — not a copy. Read-only use is safe. Any mutation must go through `updateNode()` or a targeted setter (`setNodeStyle`, `setNodeStatus`) to trigger events; direct property assignment silently bypasses listeners.

#### `getNodes()` → `node[]`
#### `hasNode(uid)` → `boolean`
#### `nodeCount` → `number`

### Edge CRUD

#### `addEdge(data)` → `edge | null`

Edge uid is deterministic: `${srcUid}-link-${targetUid}`. Returns existing edge if already present (pass `forceUpdate: true` to override).

```js
store.addEdge({
  srcUid:    'concept-1',
  targetUid: 'concept-2',
  type:      'default',      // optional, defaults to 'default'
  createdBy: 'user-1',
});
```

#### `removeEdge(uid)`
#### `getEdge(uid)` → `edge | null`
#### `getEdges()` → `edge[]`
#### `refreshEdgePath(edgeUid)` → `edge`

Recompute the SVG path for a single edge. Call after moving one of its endpoint nodes.

#### `refreshEdgePathsOfNode(nodeUid)`

Recompute paths for all edges connected to a given node. Called internally by `moveNode`.

### Targeted mutations

#### `moveNode(uid, x, y)` → `node | null`

Moves node to `(x, y)` in SVG space, refreshes connected edge paths, emits `'node:moved'`. Use this instead of `updateNode` for drag — it emits the narrow event so only the moved node and its edges need to update.

#### `setNodeStatus(uid, status)`

Update occurant lifecycle status. Emits narrow `'node:status-changed'` — status indicators update without a full node re-render.

```js
store.setNodeStatus('task-1', 'running');
store.setNodeStatus('task-1', 'completed');
```

#### `setNodeStyle(uid, styleObj)`
#### `getNodeStyle(uid)` → `object | null`

The single write path for per-node style data. `setNodeStyle` writes to `node.styleObj` and emits narrow `'node:style-changed'` — style overlays update without a full node re-render.

`getNodeStyle` reads from the store as the source of truth. Returns `null` if the node doesn't exist or has no committed styles.

```js
store.setNodeStyle('concept-1', { background: '#f5f0e8', fontWeight: 'bold' });
store.on('node:style-changed', ({ uid, styleObj, node }) => applyStyle(uid, styleObj));

const persisted = store.getNodeStyle('concept-1');  // { background: '#f5f0e8', ... }
```

::: tip
Always use `setNodeStyle` rather than mutating `node.styleObj` directly. Direct mutation bypasses `'node:style-changed'` — presentation layers won't know to update.
:::

### Layout

#### `computeLayout(options?)`

Compute positions for all nodes and refresh all edge paths. Emits `'layout:computed'`.

Already-placed nodes (with `_computedInitialProps: true`) are skipped — user-dragged positions survive layout runs. To force recompute on a node, set `node._computedInitialProps = false` first.

```js
store.computeLayout({ paginationThreshold: 5 });
```

| Option | Type | Description |
|---|---|---|
| `paginationThreshold` | `number` | Siblings beyond this index are given `visibility: 'hidden'` |

### Bulk operations

#### `ingest(nodesData, options?)`

Batch-add nodes, build edges from `node.links`, compute layout, emit one set of events.

Handles out-of-order arrival — if node B arrives before node A but links to A, B's edge to A is built when A arrives.

```js
store.ingest([
  { uid: 'a', type: 'continuant', title: 'Root' },
  { uid: 'b', type: 'occurant',   title: 'Process', links: [{ targetUid: 'a' }] },
], { paginationThreshold: 8 });
```

#### `updateNodesBatch(updates, field)`

Bulk update a specific field across multiple nodes without triggering layout.

```js
store.updateNodesBatch(serverUpdates, 'content');  // 'content' | 'style' | 'tags'
```

### Action resolution

#### `resolveActionsForSelection(selectedUids)` → `object[]`

Merges per-node `availableActions` with graph defaults, deduplicates, then filters by each action's `applicability` schema.

```js
const actions = store.resolveActionsForSelection(['node-1', 'node-2']);
```

Action applicability schema:

```js
{
  id:            'my-action',
  label:         'Do something',
  applicability: {
    minNodes:    1,          // minimum selection size
    maxNodes:    Infinity,   // maximum selection size
    nodeTypes:   ['continuant'],    // restrict to these types
    nodeVariants: ['draft'],        // restrict to these variants
  }
}
```

#### `resolveContextMenuActions(uid)` → `object[]`

Returns `node.contextMenuActions` if set, otherwise `defaultContextMenuActions`.

### Viewport

#### `setViewport({ width, height })`
#### `getViewport()` → `{ width, height }`

### Batching

#### `batch(fn)`

Defer all events until fn completes. Nested batches supported.

```js
store.batch(() => {
  store.addNode(nodeA);
  store.addNode(nodeB);
  store.addEdge({ srcUid: 'a', targetUid: 'b' });
});
// One 'nodes:changed' and one 'edges:changed' emitted here
```

::: warning Sync only
`fn` must be synchronous. Async callbacks are not supported — `#flushEvents()` fires before any awaited work completes, so async mutations inside the batch bypass the dedup mechanism. Use sequential `await` calls outside `batch()` instead.
:::

### Lifecycle

#### `destroy()`

Clears all state and removes all event listeners. Call from component teardown.

---

## EventBus

Base class for all state machines. Extend it for custom event sources.

```js
import { EventBus } from '@wity/graph-headless';

class MyStore extends EventBus {
  doSomething() {
    this.emit('did:something', { data: 42 });
  }
}
```

| Method | Returns | Description |
|---|---|---|
| `on(event, handler)` | `() => void` (unsubscribe) | Subscribe to an event |
| `once(event, handler)` | `() => void` (unsubscribe) | Subscribe once |
| `off(event, handler)` | — | Remove specific handler |
| `emit(event, payload)` | — | Emit to all handlers; wildcard `'*'` receives `{ event, payload }` |
| `clear(event?)` | — | Remove all handlers for an event, or all if omitted |

---

## SelectionManager

Headless selection state. Extends `EventBus`.

```js
const selection = new SelectionManager(store);
```

Requires a `GraphStore` — auto-deselects nodes on `'node:removed'`.

### Methods

| Method | Description |
|---|---|
| `select(uid, { addToSelection? })` | Select. Clears previous selection unless `addToSelection: true` |
| `deselect(uid)` | Deselect a node |
| `toggle(uid, { addToSelection? })` | Toggle selection |
| `clear(excludeUids?)` | Clear all; optionally keep specified UIDs selected |

### Queries

| Property/Method | Returns | Description |
|---|---|---|
| `getSelected()` | `node[]` | All selected nodes |
| `getSelectedUids()` | `string[]` | All selected UIDs |
| `isSelected(uid)` | `boolean` | |
| `count` | `number` | |
| `isMulti` | `boolean` | More than one selected |
| `lastSelected` | `node \| null` | Most recently selected node |
| `lastDeselected` | `node \| null` | Most recently deselected node |
| `compositeUid` | `string` | Sorted UIDs joined by `\|` — stable cache key |
| `compositeLabel` | `string` | Human-readable label from node titles |

### Events

```js
selection.on('selection:changed', ({ selected, lastSelected, lastDeselected, isMulti, compositeUid, compositeLabel }) => {
  updateToolbar(selected);
});
```

---

## PlaceholderManager

Drag-to-link state machine. Extends `EventBus`. Keeps drag interaction logic out of the rendering layer.

```js
import { PlaceholderManager } from '@wity/graph-headless';
const dragLink = new PlaceholderManager(store, {
  snapThreshold:  300,   // uniform snap radius in px (default)
  // snapXThreshold: 400, snapYThreshold: 200,  // or set axes independently
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `snapThreshold` | `number` | `300` | Uniform horizontal + vertical snap radius (px) |
| `snapXThreshold` | `number` | `300` | Horizontal snap radius — overrides `snapThreshold` |
| `snapYThreshold` | `number` | `300` | Vertical snap radius — overrides `snapThreshold` |

### State machine

```
idle → start(fromUid)  → active
active → update(x, y)  → active (with snap detection)
active → commit()      → idle  (real edge created)
active → cancel()      → idle  (no edge)
```

### Methods

| Method | Description |
|---|---|
| `start(fromUid)` | Begin drag from a node; creates invisible placeholder node + edge |
| `update(x, y, xThreshold?, yThreshold?)` | Move placeholder; detects snap targets within threshold (constructor default or per-call override) |
| `commit(explicitTargetUid?)` | Create real edge; remove placeholder |
| `cancel()` | Remove placeholder, no edge created |

### Events

```js
dragLink.on('draglink:started',   ({ fromNode }) => { ... });
dragLink.on('draglink:updated',   ({ fromNode, placeholderUid, x, y, snapTarget }) => { ... });
dragLink.on('draglink:committed', ({ fromNode, targetNode, edgeUid }) => { ... });
dragLink.on('draglink:cancelled', ({ fromNode }) => { ... });
```

---

## PanZoomState

Headless pan/zoom state machine. No DOM.

```js
const panZoom = new PanZoomState({ minZoom: 0.1, maxZoom: 5 });
```

### Mutations

| Method | Description |
|---|---|
| `setPan(x, y)` | Set pan in screen pixels |
| `panBy(dx, dy)` | Relative pan |
| `zoomToPoint(zoom, screenX, screenY)` | Zoom while keeping screen point fixed (wheel zoom) |
| `zoomToCenter(zoom)` | Zoom around viewport centre (programmatic) |
| `setZoomRaw(zoom)` | Set zoom without adjusting pan |
| `setMinZoom(v)` | |
| `setMaxZoom(v)` | |

### Queries

| Property/Method | Returns |
|---|---|
| `pan` | `{ x, y }` |
| `zoom` | `number` |
| `screenToSvg(sx, sy)` | `[svgX, svgY]` |
| `svgToScreen(svgX, svgY)` | `[screenX, screenY]` |

---

## GraphCanvasState

Single source of truth for all computed canvas state. Composes `GraphStore` + `PanZoomState` + viewport.

```js
const canvas = new GraphCanvasState(store, panZoom, { width: 1200, height: 800 });
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `getTransform()` | `string` | SVG `matrix(...)` string for `<g class="kg-viewport">` |
| `getNodeScreenRect(uid)` | `{ x, y, width, height }` | Screen-space bounding rect |
| `getOverlayAnchor(uid, gap?)` | `{ x, y }` | Screen position for action overlay (right of node top edge) |
| `getPanTargetForNode(uid, opts?)` | `{ x, y }` | Pan values to centre node at given zoom |
| `isNodeInViewport(uid)` | `boolean` | Whether any part of the node is visible |
| `screenToSvg(sx, sy)` | `[svgX, svgY]` | Coordinate transform |
| `svgToScreen(svgX, svgY)` | `[screenX, screenY]` | Coordinate transform |

`getPanTargetForNode` options:

| Option | Default | Description |
|---|---|---|
| `zoom` | current zoom | Zoom level to use when computing |
| `xOffset` | `0` | Shift node left of centre by this many SVG units |
| `yOffset` | `0` | Shift node above centre (positive = up) |

---

## Traversal

All functions are pure and stateless. They accept `Map<uid, node>` and `Map<uid, edge>` directly, or use the delegate methods on `GraphStore`.

All functions return **node objects** (not UIDs). To get UIDs: `result.map(n => n.uid)`.

```js
import { getChildren, getDescendants, /* ... */ } from '@wity/graph-headless';

// Direct (stateless, pass maps)
const children = getChildren('root-id', nodesMap);

// Via store delegate (convenience)
const children = store.getChildren('root-id');
```

| Function | Description |
|---|---|
| `getChildren(uid, nodes)` | Direct children (nodes linking TO this node) |
| `getDescendants(uid, nodes)` | All descendants depth-first |
| `getParents(uid, nodes)` | Direct parents (nodes this node links TO) |
| `getAncestors(uid, nodes)` | Full ancestor chain |
| `getRoots(nodes)` | Nodes with no outgoing links |
| `getEdgesOfNode(uid, edges)` | All edges where node is source or target |
| `getOutgoingEdges(uid, edges)` | Edges where node is source |
| `getIncomingEdges(uid, edges)` | Edges where node is target |
| `findCommonParent(uidA, uidB, nodes)` | First shared parent, or `false` |
| `getDepth(uid, nodes)` | Distance from nearest root (0 = root) |

---

## Layout

### `computeLayout(nodes, viewBox, options)` → `node[]`

Horizontal tree layout. Modifies nodes in-place, returns the array.

Called internally by `store.computeLayout()` — you rarely need this directly.

### `computeNodePosition(node, nodeIdx, nodes, viewBox, options)` → `node`

Position a single node. Idempotent — skips if `node._computedInitialProps` is `true`.

### `getNodesAroundPoint(x, y, nodes, xThreshold, yThreshold, excludeUids)` → `node[]`

Proximity query. Returns nodes within `(xThreshold, yThreshold)` of point. Used by `PlaceholderManager` for snap detection.

### `rectsOverlap(a, b)` → `boolean`
### `getOverlappingNodes(nodes)` → `[node, node][]`
### `resolveOverlaps(nodes, padding?)` → `node[]`

Overlap detection and resolution utilities. `resolveOverlaps` iteratively shifts nodes apart (up to 10 passes). Useful for custom layout post-processing.

---

## Geometry

### Point / rect queries

```js
import { getNodeAtPoint, getNodesInRect } from '@wity/graph-headless';
```

| Function | Returns | Description |
|---|---|---|
| `getNodeAtPoint(x, y, nodes, opts?)` | `node \| null` | Topmost node whose bounding box contains `(x, y)`. Options: `exclude: string[]`, `padding: number` |
| `getNodesInRect(rx, ry, rw, rh, nodes)` | `node[]` | All nodes whose bounding box overlaps the given rectangle |

```js
// Hit-test a click in SVG space
const hit = getNodeAtPoint(svgX, svgY, store.getNodes(), { exclude: ['placeholder-123'] });

// Rubber-band selection
const inRect = getNodesInRect(selX, selY, selW, selH, store.getNodes());
```

### Port geometry

```js
import { getPortSvgPos, getPortDots, getActiveInputPorts,
         getDefaultOutputPortId, getDefaultInputPortId } from '@wity/graph-headless';
```

| Function | Returns | Description |
|---|---|---|
| `getPortSvgPos(node, portId, getConfig)` | `{ x, y }` | Absolute SVG position of a named port |
| `getPortDots(node, getConfig)` | `object[]` | All port positions for a node |
| `getActiveInputPorts(node, edges, getConfig)` | `object[]` | Declared input ports + overflow port if all connected |
| `getDefaultOutputPortId(type, getConfig)` | `string` | First output port id, or `'out'` |
| `getDefaultInputPortId(type, getConfig)` | `string` | First input port id, or `'in'` |

### Path geometry

```js
import { horizontalLinkPath, computeNodeLinkPath } from '@wity/graph-headless';
```

| Function | Returns | Description |
|---|---|---|
| `horizontalLinkPath(source, target)` | `string` | SVG `d` attribute for cubic bezier between two `{ x, y }` points |
| `computeNodeLinkPath(srcNode, tgtNode, getConfig, srcPortId?, tgtPortId?)` | `string` | Full path resolving port positions |

### Pan target

```js
import { getPanTargetForNode, getFitToContent } from '@wity/graph-headless';

const pan = getPanTargetForNode(node, layout, viewport, { zoom: 1.2, yOffset: 100 });
// → { x, y }  — set panZoom.setPan(pan.x, pan.y)
```

### `getFitToContent(nodes, viewport, options?)` → `{ pan, zoom } | null`

Pure math — compute the pan and zoom that fit all placed nodes into the viewport. Returns `null` if no nodes have been placed yet.

Accepts any array of `{ x, y, w, h }` objects — not just `store.getNodes()`. Unplaced nodes (`x == null`) are skipped automatically.

```js
// From store
const result = getFitToContent(store.getNodes(), canvas.getViewport());

// From a filtered subset
const result = getFitToContent(store.getNodes().filter(n => n.type === 'entity'), viewport);

if (result) {
    // Animated (simultaneous pan+zoom — use animateToFit, not animateTo)
    animateToFit(result);

    // Or instant
    canvas.setPan(result.pan.x, result.pan.y);
    canvas.zoomToCenter(result.zoom);
}
```

::: tip Use `animateToFit`, not `animateTo`
`getFitToContent` computes pan at the target zoom. `animateTo` sequences pan→zoom, which shifts the final pan. Use `animateToFit` from `bindPanZoom` for correct animated fit-all.
:::

| Option | Type | Default | Description |
|---|---|---|---|
| `padding` | `number` | `0.9` | Fraction of viewport to fill — `0.9` leaves ~10% margin on each side |
| `minZoom` | `number` | `0.1` | Floor on computed zoom |
| `maxZoom` | `number` | `1` | Ceiling on computed zoom — default prevents magnifying a small graph beyond 1:1 |

---

## Ontology API

```js
import {
  NODE_TYPES, DEFAULT_NODE_TYPE, getNodeTypeConfig, registerNodeType,
  LINK_TYPES, DEFAULT_LINK_TYPE, getLinkTypeConfig, registerLinkType,
} from '@wity/graph-headless';
```

| Export | Description |
|---|---|
| `NODE_TYPES` | `{ CONTINUANT: 'continuant', OCCURANT: 'occurant', PLACEHOLDER: 'placeholder' }` |
| `DEFAULT_NODE_TYPE` | `'continuant'` |
| `getNodeTypeConfig(type)` | Returns config for `type`, falls back to `'continuant'` if unknown |
| `registerNodeType(name, config)` | Register a new custom node type (full config required) |
| `patchNodeType(name, patch)` | Partially update a built-in or registered type — deep-merges per structural key |
| `LINK_TYPES` | `{ DEFAULT: 'default', PLACEHOLDER: 'placeholder', SEMANTIC: 'semantic' }` |
| `DEFAULT_LINK_TYPE` | `'default'` |
| `getLinkTypeConfig(type)` | Returns config for `type` |
| `registerLinkType(name, config)` | Register a custom link type at runtime |

### `patchNodeType(name, patch)`

Partially update a built-in or registered node type. Deep-merges one level per structural key — only the fields you provide change; everything else (ports, spacing, classes) stays untouched.

```js
import { patchNodeType } from '@wity/graph-headless';

// Change occurant height — only express what changes
patchNodeType('occurant', {
  layout: { height: 100 },    // other layout keys (width, xSpacing, ySpacing) unchanged
  style:  { heightCss: '6.25em' },  // other style keys unchanged
});
```

**Call at app initialisation, before any `store.addNode()` for that type.** `node.w` and `node.h` are stamped at `addNode()` time — patching after nodes exist leaves their cached dimensions stale until recreated.

Port positions (`getPortSvgPos`) always read the live config, so edge paths and port dots reflect the patch immediately.

`layout.height` and `style.heightCss` must be kept in sync manually — they are in different units (px vs em) and the library has no root font-size knowledge to convert between them.

**vs `registerNodeType`:** use `registerNodeType` for brand-new types (requires a full config); use `patchNodeType` to adjust an existing type.

---

## Actors & Session

See [Actors & Sessions guide](/guide/actors-and-sessions) for full usage.

```js
import { ActorRegistry, SessionLog, PresenceState } from '@wity/graph-headless';
```

| Class | Description |
|---|---|
| `ActorRegistry` | Lookup store mapping actorId strings to display metadata |
| `SessionLog` | Append-only event log; auto-captures GraphStore events; `record()`, `getEvents()` |
| `PresenceState` | Live per-actor snapshot; cursor positions + selections; `'presence:updated'` event |

---

## BatchProcessor

Sequential async task queue.

```js
import { BatchProcessor } from '@wity/graph-headless';

const queue = new BatchProcessor({ intervalMs: 50 });
queue.enqueue(async () => await fetchNode('a'));
queue.enqueue(async () => await fetchNode('b'));
await queue.drain();
```

| Method/Property | Description |
|---|---|
| `enqueue(fn)` | Add async task; returns `this` (chainable) |
| `drain()` | Returns `Promise` that resolves when queue is empty and idle |
| `size` | Pending task count |
| `busy` | `boolean` — currently processing |
| `clear()` | Remove pending tasks (not the currently running one) |

Errors from individual tasks are logged but do not stop the queue.
