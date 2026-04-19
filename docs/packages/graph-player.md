# @wity/graph-player

Temporal simulation engine. Replays a graph snapshot progressively, emitting events as nodes and edges appear and as occurant lifecycle timestamps are crossed.

No DOM. No rendering. Works with any presentation layer.

```js
import { GraphPlayer, NODE_STATUS } from '@wity/graph-player';
```

---

## Concept

`GraphPlayer` takes a **snapshot** — a `{ nodes, edges }` object with optional timestamp fields — and turns it into a timed event stream. You wire the events into a `GraphStore` to build the graph progressively.

This separation is intentional: the player owns *scheduling* and *event emission*. The store owns *state*. The presentation layer owns *DOM*.

```
GraphPlayer  ──── 'node:appear'  ────→  store.addNode()
             ──── 'edge:appear'  ────→  store.addEdge()
             ──── 'node:update'  ────→  store.setNodeStatus()
```

---

## Setup

```js
const player = new GraphPlayer(snapshot, options);

// Wire events to the store
player.on('node:appear', ({ node })       => store.addNode(node));
player.on('edge:appear', ({ edge })       => store.addEdge(edge));
player.on('node:update', ({ uid, status}) => store.setNodeStatus(uid, status));
player.on('complete',    ()               => console.log('playback complete'));
player.on('reset',       ()               => store.destroy());

player.play();
```

---

## Constructor

```js
new GraphPlayer(snapshot, options)
```

### snapshot

```js
{
  nodes: node[],
  edges: edge[],
}
```

Temporal fields on nodes (all optional, epoch ms):

| Field | Applies to | Meaning |
|---|---|---|
| `createdAt` | continuant, occurant | When the node appears |
| `startedAt` | occurant | When execution began → emits `NODE_STATUS.RUNNING` |
| `completedAt` | occurant | When it succeeded → emits `NODE_STATUS.COMPLETED` |
| `erroredAt` | occurant | When it failed → emits `NODE_STATUS.ERRORED` |
| `cancelledAt` | occurant | When it was cancelled → emits `NODE_STATUS.CANCELLED` |

Temporal field on edges:

| Field | Default | Meaning |
|---|---|---|
| `createdAt` | `max(src.createdAt, target.createdAt)` | When the edge appears |

If `createdAt` is absent on a node, it defaults to `0` (appears at the start).

### options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `'sequential'` | Playback mode (see below) |
| `speed` | `number` | `1` | Speed multiplier for `'speed'` mode |
| `maxGap` | `number` | `3000` | Max gap in ms for `'maxGap'` mode |
| `interval` | `number` | `800` | Fixed delay in ms for `'sequential'` mode |
| `loop` | `boolean` | `false` | Auto-restart after `'complete'` |
| `loopDelay` | `number` | `2000` | ms to wait before restarting on loop |

---

## Playback modes

| Mode | Behaviour |
|---|---|
| `'sequential'` | Ignores timestamps. Each event fires `interval` ms after the previous. |
| `'speed'` | Real timestamp gaps divided by `speed`. `speed: 2` plays at 2× real time. |
| `'realtime'` | Exact real timestamp gaps. A 5-second gap is 5 seconds of waiting. |
| `'maxGap'` | Real timestamp gaps, but any gap longer than `maxGap` ms is clamped. Prevents stalls on long-running processes. |

```js
// Show a 30-minute agentic run in about 10 seconds
new GraphPlayer(snapshot, { mode: 'speed', speed: 180 });

// Same, but cap any single gap at 2 seconds
new GraphPlayer(snapshot, { mode: 'maxGap', maxGap: 2000 });

// Demo mode — one event per 600ms regardless of timestamps
new GraphPlayer(snapshot, { mode: 'sequential', interval: 600, loop: true, loopDelay: 1500 });
```

---

## Methods

| Method | Description |
|---|---|
| `play()` | Start or resume playback |
| `pause()` | Pause (cursor position is preserved) |
| `reset()` | Pause and reset cursor to start; emits `'reset'` |

---

## Properties

| Property | Type | Description |
|---|---|---|
| `isPlaying` | `boolean` | Whether playback is active |
| `eventCount` | `number` | Total number of events in the timeline |
| `progress` | `number` | `0–1`, current position in the timeline |

---

## Events

```js
player.on('node:appear', ({ node }) => {
  // Add node to the graph
  store.addNode(node);
});

player.on('edge:appear', ({ edge }) => {
  // Draw edge (both endpoints already exist)
  store.addEdge(edge);
});

player.on('node:update', ({ uid, status }) => {
  // Occurant lifecycle transition
  store.setNodeStatus(uid, status);
});

player.on('reset', () => {
  // Player was reset — clear the graph
  store.destroy();
});

player.on('complete', () => {
  // All events fired
});
```

---

## NODE_STATUS

Constants for occurant lifecycle status values.

```js
import { NODE_STATUS } from '@wity/graph-player';

NODE_STATUS.CREATED    // 'created'
NODE_STATUS.RUNNING    // 'running'
NODE_STATUS.COMPLETED  // 'completed'
NODE_STATUS.ERRORED    // 'errored'
NODE_STATUS.CANCELLED  // 'cancelled'
```

These match what `GraphPlayer` emits in `'node:update'` payloads, and what `store.setNodeStatus()` expects.

---

## Timeline construction

The player builds a sorted event array at construction time:

1. One `'node:appear'` per node (at `createdAt` or `0`)
2. One `'node:update'` per lifecycle field present (`startedAt`, `completedAt`, `erroredAt`, `cancelledAt`)
3. One `'edge:appear'` per edge (at `edge.createdAt` or `max(src.createdAt, tgt.createdAt)`)
4. Sort by timestamp; same-timestamp events keep insertion order (nodes before edges)

---

## Full example

```js
import { GraphStore, SelectionManager } from '@wity/graph-headless';
import { GraphPlayer, NODE_STATUS }     from '@wity/graph-player';

const store  = new GraphStore({ viewport: { width: 1200, height: 800 } });

const snapshot = {
  nodes: [
    { uid: 'task-1', type: 'occurant', title: 'Fetch data',     createdAt: 0,    startedAt: 100,  completedAt: 800  },
    { uid: 'task-2', type: 'occurant', title: 'Process',        createdAt: 0,    startedAt: 850,  completedAt: 2000 },
    { uid: 'result', type: 'continuant', title: 'Final output', createdAt: 2100 },
  ],
  edges: [
    { uid: 'e1', srcUid: 'task-1', targetUid: 'task-2' },
    { uid: 'e2', srcUid: 'task-2', targetUid: 'result' },
  ],
};

const player = new GraphPlayer(snapshot, {
  mode:      'speed',
  speed:     3,
  loop:      true,
  loopDelay: 2000,
});

player.on('node:appear', ({ node }) => {
  store.addNode(node);
  store.computeLayout();
});
player.on('edge:appear', ({ edge }) => store.addEdge(edge));
player.on('node:update', ({ uid, status }) => store.setNodeStatus(uid, status));
player.on('reset',       () => { store.destroy(); });

player.play();
```
