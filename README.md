# wity-graph

A headless, ontologically-grounded directed graph library. Zero dependencies. Production-grade.

**[Full documentation → wity.ai/stack/knowledge-graph](https://www.wity.ai/stack/knowledge-graph/)**

---

## Overview

wity-graph is built in three independent, composable layers:

| Package | Purpose | Standalone? |
|---|---|---|
| [`@wity/graph-headless`](https://www.wity.ai/stack/knowledge-graph/packages/graph-headless) | State, layout, traversal, geometry, ontology | Yes |
| [`@wity/graph-ui-compute`](https://www.wity.ai/stack/knowledge-graph/packages/graph-ui-compute) | DOM geometry, pan/zoom, interaction bindings | Requires headless |
| [`@wity/graph-player`](https://www.wity.ai/stack/knowledge-graph/packages/graph-player) | Temporal replay of graph snapshots | Requires headless |

The headless layer owns all math — layout, geometry, coordinate transforms, traversal. The rendering layer owns only DOM mutations. No framework coupling at any layer.

## Quick start

```js
import { GraphStore, SelectionManager, GraphCanvasState } from '@wity/graph-headless';

const store     = new GraphStore({ viewport: { width: 1200, height: 800 } });
const selection = new SelectionManager(store);
const canvas    = new GraphCanvasState(store, { width: 1200, height: 800, minZoom: 0.1, maxZoom: 5 });

store.on('layout:computed', ({ nodes, edges }) => render(nodes, edges));

store.ingest([
  { uid: 'a', type: 'continuant', title: 'Concept A' },
  { uid: 'b', type: 'continuant', title: 'Concept B', links: [{ targetUid: 'a' }] },
]);
```

## Key design principles

- **Headless-first.** Pure state and geometry with no DOM coupling — wire any renderer.
- **Ontologically grounded.** Nodes are Continuants (persisting things) or Occurants (processes), grounded in Basic Formal Ontology.
- **Narrow events.** `node:moved`, `node:status-changed`, `node:style-changed` update a single node. `nodes:changed` handles bulk. Both exist.
- **Batching.** `store.batch(fn)` defers all events until the block completes, preventing re-render storms.
- **Zero dependencies.** Bezier paths, layout, pan/zoom, keyed diffing — all hand-written.

## Documentation

Full API reference, architecture guide, and package docs:
**https://www.wity.ai/stack/knowledge-graph/**

---

Built by [Wity AI](https://www.wity.ai)
