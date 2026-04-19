---
layout: home

hero:
  name: wity-graph
  tagline: A headless, ontologically-grounded directed graph library. Zero dependencies. Production-grade.
  actions:
    - theme: brand
      text: Architecture
      link: /guide/architecture
    - theme: alt
      text: API Reference
      link: /packages/graph-headless

features:
  - title: Headless-first
    details: Pure state, layout, and geometry with no DOM coupling. Wire any renderer — React, Svelte, vanilla SVG, custom.
  - title: Ontologically grounded
    details: Nodes are either Continuants (persisting things) or Occurants (processes). Grounded in Basic Formal Ontology — practically, not dogmatically.
  - title: Zero dependencies
    details: No D3, no framework imports. Every algorithm — bezier paths, layout, pan/zoom, keyed diffing — is hand-written and auditable.
  - title: Layered & composable
    details: Use graph-headless alone for pure state logic. Add graph-ui-compute for DOM bindings. Add graph-player for temporal replay.
---

# wity-graph

A production-grade directed graph library built in three independent, composable layers.

## Packages

| Package | Purpose | Use independently? |
|---|---|---|
| [`@wity/graph-headless`](/packages/graph-headless) | State, layout, traversal, geometry, ontology | Yes |
| [`@wity/graph-ui-compute`](/packages/graph-ui-compute) | DOM geometry, interaction bindings | Yes (requires headless) |
| [`@wity/graph-player`](/packages/graph-player) | Temporal replay of graph snapshots | Yes (requires headless) |
| `@wity/graph` | Re-exports all three | Convenience |

## Quick start

```js
import {
  GraphStore,
  SelectionManager,
  PanZoomState,
  GraphCanvasState,
} from '@wity/graph-headless';

// Create the store
const store = new GraphStore({ viewport: { width: 1200, height: 800 } });
const selection = new SelectionManager(store);
const panZoom = new PanZoomState();
const canvas = new GraphCanvasState(store, panZoom, { width: 1200, height: 800 });

// React to changes
store.on('layout:computed', ({ nodes, edges }) => render(nodes, edges));
selection.on('selection:changed', ({ selected }) => updateToolbar(selected));

// Add nodes and compute layout
store.ingest([
  { uid: 'a', type: 'continuant', title: 'Concept A' },
  { uid: 'b', type: 'continuant', title: 'Concept B', links: [{ targetUid: 'a' }] },
]);
```

## Design principles

- **Headless layer owns all math.** Layout, geometry, coordinate transforms, traversal — none of this belongs in the rendering layer.
- **Rendering layer owns only DOM mutations.** It subscribes to events and applies the computed state. No logic lives there.
- **Event-driven, not reactive-framework-dependent.** The EventBus is plain pub/sub. Wire it into React state, Svelte stores, or vanilla JS — your choice.
- **Narrow events over broad ones.** `node:moved` and `node:status-changed` let the renderer update a single node. `nodes:changed` is for bulk changes. Both exist.
- **Batching prevents re-render storms.** `store.batch(fn)` defers all events until the block completes.
