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
  nodes:  node[],
  edges:  edge[],
  events: event[],   // optional — any custom events slotted into the timeline
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

### snapshot.events — custom timeline events

Any additional event type — cursor movements, selections, agent signals — can be scripted into the timeline alongside nodes and edges.

```js
{
  type:     string,        // emitted as-is — 'cursor:moved', 'selection:changed', anything
  t:        number,        // timestamp in ms; defaults to 0 if absent
  payload:  object,        // emitted verbatim, merged with actorId if present
  actorId:  string,        // optional — merged into emitted payload for convenience
}
```

`actorId` being merged into payload means subscribers receive a flat object:

```js
// Snapshot entry:
{ type: 'cursor:moved', actorId: 'user-1', t: 500, payload: { x: 320, y: 210 } }

// What the subscriber receives:
player.on('cursor:moved', ({ actorId, x, y }) => { ... })
// → { actorId: 'user-1', x: 320, y: 210 }
```

Same-t ordering: nodes → edges → custom events (insertion order preserved within each group).

**Backward compatible** — snapshots without an `events` array behave identically to before.

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
| `seekTo(t)` | Seek to timestamp `t` (epoch ms). Replays all events up to `t` synchronously, then parks cursor. |
| `appendEvents(newEvents)` | Merge new events into the sorted timeline for live/streaming data sources. |

---

## Properties

| Property | Type | Description |
|---|---|---|
| `isPlaying` | `boolean` | Whether playback is active |
| `eventCount` | `number` | Total number of events in the timeline |
| `progress` | `number` | `0–1`, current position in the timeline |
| `startTime` | `number` | Epoch ms of the first event (or `0`) |
| `endTime` | `number` | Epoch ms of the last event (or `0`) |
| `duration` | `number` | `endTime - startTime` in ms |
| `currentTime` | `number` | Epoch ms at the current cursor position |

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

## Seeking

`seekTo(t)` pauses playback, resets the cursor, then synchronously emits all events whose timestamp is `≤ t`. Use it to materialise graph state at an arbitrary point in time — for timeline scrubbers, simulation inspection, or state-at-time queries.

```js
// Jump to 14:00 (in epoch ms)
player.seekTo(targetMs);

// The store now reflects the graph state at that moment
const nodesAtTime = store.getNodes();
```

After seeking, call `play()` to resume from that point.

---

## Live / streaming

`appendEvents(newEvents)` merges new events into the sorted timeline by timestamp. Events ahead of the current cursor will be reached naturally during playback. Use for live data feeds — simulation engines, real-time telemetry, streaming CoT updates.

```js
// Simulation engine pushes new state
player.appendEvents([
    { type: 'node:update', t: Date.now(), payload: { uid: 'V_001', status: 'closed' } },
    { type: 'node:appear', t: Date.now(), payload: { node: newSensorNode } },
]);
```

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
