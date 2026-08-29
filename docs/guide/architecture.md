# Architecture

## Layer overview

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation Layer  (DOM mutations + framework reactivity)  │
│  React / Svelte / Muffin / vanilla — your choice             │
├──────────────────────────────────────────────────────────────┤
│  graph-ui-compute                                            │
│  DOM geometry, interaction bindings, keyed diffing           │
│  bindPanZoom · bindNodeDrag · bindCursorCapture              │
│  keyedJoin · svgPointer · svg-elements                       │
├──────────────────────────────────────────────────────────────┤
│  GraphCanvasState  (composed state: store + pan/zoom)        │
│  Single source of truth for all computed canvas state.       │
│  getTransform · getNodeScreenRect · getOverlayAnchor         │
│  getPanTargetForNode · isNodeInViewport · screenToSvg        │
├─────────────────────────────┬────────────────────────────────┤
│  GraphStore                 │  PanZoomState                  │
│  node/edge data + layout    │  pan, zoom, coord math         │
├─────────────────────────────┴────────────────────────────────┤
│  GraphAbstract                                               │
│  pure combinatorial graph — vertices + typed edges only      │
│  no coordinates, no geometry, no embedding                   │
├──────────┬───────────────────────────┬───────────────────────┤
│  Layout  │  Traversal                  │  Geometry           │
├──────────┴─────────────────────────────┴─────────────────────┤
│  Ontology  (node-types, link-types — BFO grounded)           │
├──────────────────────────────────────────────────────────────┤
│  Serialization  (serialize → XML, parse → snapshot)          │
├──────────────────────────────────────────────────────────────┤
│  Actors & Session  (layered on top, independent)             │
│  ActorRegistry · SessionLog · PresenceState                  │
├──────────────────────────────────────────────────────────────┤
│  EventBus · BatchProcessor  (infrastructure)                 │
└──────────────────────────────────────────────────────────────┘
```

`graph-player` sits alongside this stack — it consumes snapshots and emits events that feed into GraphStore.

`graph-geo` also sits alongside — it projects nodes from any spatial coordinate system (geographic, floor plan, orbital, game map) to canvas x/y via a pluggable projection adapter, replacing PanZoomState + layout when the graph is rendered on an external spatial system.

---

## The critical invariant

> **The headless layer computes all state. The rendering layer executes only DOM mutations.**

No layout math, no coordinate transforms, no geometry — none of this belongs in the renderer. The renderer reads computed state from `GraphCanvasState` and `GraphStore`, subscribes to events, and applies them to the DOM. That's its entire job.

This invariant is what makes the library work across multiple presentation layers without rewriting any logic.

---

## Data flow

```
User interaction  →  graph-ui-compute event handlers
                  →  store.moveNode() / store.addNode() / etc.
                  →  GraphStore emits narrow events
                  →  Presentation layer re-renders minimal DOM
```

```
Programmatic mutation  →  store.ingest() / store.batch()
                       →  store.computeLayout()
                       →  'layout:computed' event
                       →  Presentation layer rebuilds node+edge elements
```

```
GraphPlayer  →  'node:appear' / 'edge:appear' / 'node:update'
             →  store.addNode() / store.addEdge() / store.setNodeStatus()
             →  normal mutation flow above
```

---

## Coordinate systems

Two coordinate spaces exist. Confusing them is the most common source of bugs.

### SVG space (graph-absolute)

- The natural coordinate system of the graph
- Node `x`, `y`, `w`, `h` are in SVG space
- Edge `path` data is in SVG space
- Port positions are in SVG space
- Cursor positions in `PresenceState` are in SVG space
- Independent of pan and zoom

### Screen space (viewport-relative)

- Pixel coordinates on screen, as seen by the user
- Used for DOM event coordinates (`clientX`, `clientY`)
- Used for pan values (pan is in screen pixels)
- Changes when the user pans or zooms

**Converting between them:**

```js
// Screen → SVG (e.g. placing a dropped node at pointer position)
const [svgX, svgY] = panZoom.screenToSvg(screenX, screenY);

// SVG → Screen (e.g. positioning a DOM overlay above a node)
const [screenX, screenY] = panZoom.svgToScreen(node.x, node.y);
```

`GraphCanvasState` wraps both and adds viewport-aware helpers (`getNodeScreenRect`, `getOverlayAnchor`, `isNodeInViewport`).

---

## Event system

All classes that emit events extend `EventBus`. The API is the same everywhere:

```js
// Subscribe — returns an unsubscribe function
const unsub = store.on('nodes:changed', ({ nodes }) => { ... });

// One-time subscription
store.once('layout:computed', ({ nodes, edges }) => { ... });

// Wildcard — receives every event
store.on('*', ({ event, payload }) => console.log(event, payload));

// Unsubscribe
unsub();

// Or remove all listeners for an event
store.clear('nodes:changed');

// Remove all listeners on the bus
store.clear();
```

### GraphStore events

| Event | Payload | When |
|---|---|---|
| `nodes:changed` | `{ nodes: node[] }` | After any node mutation (batched) |
| `edges:changed` | `{ edges: edge[] }` | After any edge mutation (batched) |
| `layout:computed` | `{ nodes, edges }` | After `computeLayout()` |
| `node:removed` | `{ uid, descendants: node[] }` | Before node deletion (for exit animations) |
| `node:moved` | `{ uid, x, y, node }` | After `moveNode()` |
| `node:status-changed` | `{ uid, status, node }` | After `setNodeStatus()` |

### SelectionManager events

| Event | Payload |
|---|---|
| `selection:changed` | `{ selected, lastSelected, lastDeselected, isMulti, compositeUid, compositeLabel }` |

### PlaceholderManager events

| Event | Payload |
|---|---|
| `draglink:started` | `{ fromNode }` |
| `draglink:updated` | `{ fromNode, placeholderUid, x, y, snapTarget }` |
| `draglink:committed` | `{ fromNode, targetNode, edgeUid }` |
| `draglink:cancelled` | `{ fromNode }` |

### SessionLog events

| Event | Payload |
|---|---|
| `session:event` | The recorded event object `{ id, type, actorId, timestamp, payload }` |

### PresenceState events

| Event | Payload |
|---|---|
| `presence:updated` | `{ actorId, presence }` |

---

## Batching

Wrapping mutations in `batch()` defers all events until the block completes. This prevents a burst of `nodes:changed` / `edges:changed` events during bulk operations.

```js
store.batch(() => {
  nodes.forEach(n => store.addNode(n));
  // No events fired yet
});
// 'nodes:changed' fires once here, with all nodes
```

Nesting works — events flush only when the outermost `batch()` completes:

```js
store.batch(() => {
  store.batch(() => {
    store.addNode(a);
    store.addNode(b);
  });
  store.addNode(c);
  // Still no events
});
// 'nodes:changed' fires once here
```

`ingest()` uses `batch()` internally, so ingesting 100 nodes emits exactly one `nodes:changed`.

---

## Using layers independently

### GraphAbstract only — pure data graph

No geometry, no layout, no positions. For knowledge graphs, dependency graphs, AI session memory — anywhere only connectivity and typed relationships matter.

```js
import { GraphAbstract } from '@wity/graph-headless';

const graph = new GraphAbstract();
graph.addNode({ uid: 'cmd:ls', type: 'command', label: 'ls' });
graph.addNode({ uid: 'cmd:grep', type: 'command', label: 'grep' });
graph.addEdge({ srcUid: 'cmd:ls', targetUid: 'cmd:grep', type: 'chains-with' });

graph.getOutgoing('cmd:ls', 'chains-with');   // [{ uid, srcUid, targetUid, type, data }]
graph.reachable('cmd:ls', 'chains-with');     // BFS — all reachable nodes
graph.getNodesByType('command');              // all command nodes
```

### graph-headless only — embedded graph

Pure state logic with geometry and layout. No DOM. Useful in server-side rendering, testing, or non-browser environments.

```js
import { GraphStore, getDescendants, computeLayout } from '@wity/graph-headless';
```

### graph-headless + graph-ui-compute

Add DOM bindings. The presentation layer is still entirely up to you.

```js
import { GraphStore } from '@wity/graph-headless';
import { bindPanZoom, bindNodeDrag, keyedJoin } from '@wity/graph-ui-compute';
```

### graph-headless + graph-player

Temporal replay with no rendering concerns.

```js
import { GraphStore } from '@wity/graph-headless';
import { GraphPlayer } from '@wity/graph-player';
```

### graph-headless + graph-geo

Geospatial graph on a map. The map library owns the viewport; graph-geo projects lat/lon to canvas x/y.

```js
import { GraphStore, registerNodeType } from '@wity/graph-headless';
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';
```

### graph-headless + graph-geo + graph-player

Geospatial graph with temporal simulation — e.g. a water network with a 24h pressure timeline.

```js
import { GraphStore } from '@wity/graph-headless';
import { GeoGraphState, SpatialIndex } from '@wity/graph-geo';
import { GraphPlayer } from '@wity/graph-player';
```

### All packages via @wity/graph

```js
import { GraphStore, bindPanZoom, GraphPlayer } from '@wity/graph';
```
