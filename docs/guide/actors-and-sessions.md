# Actors & Sessions

## Overview

The actor and session model is a layer built *on top of* the graph — it does not modify any graph structure and has zero impact on existing functionality. It answers three questions the core graph deliberately ignores:

1. **Who** created or modified a node?
2. **What happened** during a working session (complete audit trail)?
3. **Where is everyone** right now (multi-user presence)?

---

## Actor attribution on nodes and edges

`createdBy` and `updatedBy` are plain data fields on nodes and edges. Pass them when calling `addNode` or `addEdge`. The headless layer carries them opaquely — no processing, no enforcement.

```js
store.addNode({
  uid:       'node-1',
  type:      'continuant',
  title:     'Research finding',
  createdBy: 'user-ankur',       // {string} — single actor, immutable once set
  updatedBy: ['user-ankur'],     // {string[]} — contributors list, grows over time
});
```

**`createdBy`** — a single actor identifier. Set once when the node is created, never changed.

**`updatedBy`** — an array of actor identifiers who have touched this node. By convention, append to it when `updateNode` is called. The array is a contributors list — it does not preserve order, frequency, or when each actor made changes. For a full audit trail, use `SessionLog`.

```js
// When updating a node, append to updatedBy
const node = store.getNode('node-1');
const updatedBy = [...new Set([...(node.updatedBy ?? []), currentActorId])];
store.updateNode('node-1', { content: 'New content', updatedBy });
```

The same fields work on edges:

```js
store.addEdge({
  srcUid:    'node-1',
  targetUid: 'node-2',
  createdBy: 'user-ankur',
});
```

---

## ActorRegistry

Maps opaque actor identifiers to display metadata. The graph layer only ever sees the string IDs. The registry is where you resolve them to names, colors, and avatars.

```js
import { ActorRegistry } from '@wity/graph-headless';

const actors = new ActorRegistry();

// Register actors — metadata shape is open, add any fields you need
actors.register('user-ankur', {
  nickname: 'Ankur',
  color:    '#e07b39',
  avatar:   'AK',
  type:     'human',
});

actors.register('agent-gpt', {
  nickname: 'Research Agent',
  color:    '#6366f1',
  type:     'agent',
});

// Lookup
const meta = actors.get('user-ankur');
// → { actorId: 'user-ankur', nickname: 'Ankur', color: '#e07b39', ... }

// Update fields over time (e.g. presence color assigned on join)
actors.update('user-ankur', { color: '#22c55e' });

// All actors
actors.getAll();   // → [{ actorId, ... }, ...]

actors.has('user-ankur');   // → true
actors.size;                // → 2
actors.unregister('agent-gpt');
```

`ActorRegistry` has no EventBus — it is a plain lookup. Hook it into your own reactivity (React state, Svelte store, etc.) if you need UI updates when actors change.

---

## SessionLog

An append-only event log. The session is the raw, complete record of everything that happened: graph mutations, cursor movements, selections, agent actions, whatever you feed it.

The graph is a *curated projection* of semantically significant events. The session is the superset.

### Setup

```js
import { SessionLog } from '@wity/graph-headless';

// Standalone — record events manually
const session = new SessionLog();

// Auto-capture GraphStore mutations
const session = new SessionLog({
  store:   store,
  actorId: 'user-ankur',   // stamped on all auto-captured events
});
```

When a `store` is provided, all GraphStore events are automatically recorded:
`nodes:changed`, `node:removed`, `node:moved`, `node:status-changed`, `edges:changed`, `layout:computed`

### Recording external events

```js
// Cursor position (from bindCursorCapture — coordinates must be SVG space)
session.record({
  type:      'cursor:moved',
  actorId:   'user-ankur',
  payload:   { x: 420, y: 310 },      // SVG space
  timestamp: Date.now(),
});

// Selection change
session.record({
  type:    'selection:changed',
  actorId: 'user-ankur',
  payload: { uids: ['node-1', 'node-2'] },
});

// Remote actor's event arriving over WebSocket
session.record({
  type:      'cursor:moved',
  actorId:   'user-priya',             // remote actor
  payload:   { x: 180, y: 95 },
  timestamp: remoteEvent.timestamp,    // preserve the original timestamp
});

// Application-defined events — any type string is accepted
session.record({
  type:    'comment:added',
  actorId: 'user-ankur',
  payload: { nodeUid: 'node-1', text: 'This looks right' },
});
```

### Querying

```js
// All events
session.getEvents();

// Filter by actor
session.getEvents({ actorId: 'user-ankur' });

// Filter by exact type
session.getEvents({ type: 'cursor:moved' });

// Filter by type prefix — all node-related events
session.getEvents({ typePrefix: 'node:' });

// Time range
session.getEvents({ since: startTs, until: endTs });

// Combine filters
session.getEvents({ actorId: 'user-ankur', typePrefix: 'node:', since: startTs });

session.size;   // total event count
```

### Reacting to new events

```js
// Emits 'session:event' on every record() call
session.on('session:event', (event) => {
  console.log(event.type, event.actorId, event.payload);
});
```

### Teardown

```js
// Unsubscribes from GraphStore, removes all listeners.
// The event log is preserved — call getEvents() after if needed.
session.destroy();
```

---

## PresenceState

Live per-actor state derived from session events. While `SessionLog` is the historical record, `PresenceState` is the current snapshot — what each actor is doing *right now*. This is what you render: cursor overlays, per-actor selection highlights, connection status.

### Setup

```js
import { PresenceState } from '@wity/graph-headless';

// Drive from a SessionLog (recommended)
const presence = new PresenceState({ sessionLog: session });

// Or standalone, updated manually
const presence = new PresenceState();
```

When driven from a `SessionLog`, `cursor:moved` and `selection:changed` events are applied automatically. All other events with a non-null `actorId` update `lastSeen`.

### Direct updates (local actor)

For the local actor, you usually want to update presence directly without logging every cursor move to the session (or log both):

```js
// Cursor from bindCursorCapture result
presence.updateCursor('user-ankur', { x: 420, y: 310 });   // SVG space
presence.updateCursor('user-ankur', null);                  // left canvas

// Selection from SelectionManager
selection.on('selection:changed', ({ selected }) => {
  presence.updateSelection('user-ankur', selected.map(n => n.uid));
});
```

### Querying

```js
presence.getPresence('user-ankur');
// → { actorId, cursor: { x, y } | null, selection: string[], lastSeen: number }

presence.getAll();            // all known actors
presence.getActiveCursors();  // actors with cursor !== null (currently on canvas)
```

### Rendering cursors

```js
// Subscribe and re-render on any change
presence.on('presence:updated', ({ actorId, presence }) => {
  if (!presence.cursor) return;

  const actor = actors.get(actorId);       // ActorRegistry lookup for color/name
  renderCursor({
    x:        presence.cursor.x,           // SVG space — apply same transform as nodes
    y:        presence.cursor.y,
    color:    actor?.color ?? '#888',
    label:    actor?.nickname ?? actorId,
  });
});
```

Cursor coordinates are SVG-space, so render them inside the same `<g>` viewport element as nodes. They will correctly follow graph content at any zoom level.

### Teardown

```js
presence.destroy();
```

---

## Cursor capture (graph-ui-compute)

`bindCursorCapture` bridges DOM pointer events to SVG coordinates. This is the only place pointer events are converted for session/presence purposes.

```js
import { bindCursorCapture } from '@wity/graph-ui-compute';

const capture = bindCursorCapture(svgEl, panZoomState, {
  onMove: ({ x, y, timestamp }) => {
    // Feed into session log (persists event, also drives PresenceState via 'session:event')
    session.record({
      type:    'cursor:moved',
      actorId: currentActorId,
      payload: { x, y },
      timestamp,
    });

    // Or update presence directly without logging (no history)
    presence.updateCursor(currentActorId, { x, y });
  },
  throttleMs: 50,   // default — 20fps is plenty for cursor rendering
});

// Teardown
capture.destroy();
```

**`throttleMs`** defaults to 50ms (20fps). Reduce for smoother animations, raise to reduce session log volume. For session logging, 100–200ms is usually sufficient.

---

## Multi-user pattern

The library does not provide a transport layer — it provides the state primitives. Here is the typical wiring for a multi-user setup:

```
Local actor:
  DOM pointermove
    → bindCursorCapture (SVG coords)
    → session.record({ type: 'cursor:moved', actorId: localId, ... })
    → send over WebSocket to server
    → server broadcasts to other clients

Remote actors:
  WebSocket message received
    → session.record({ type: 'cursor:moved', actorId: remoteId, payload: { x, y }, timestamp })
    → PresenceState receives 'session:event'
    → PresenceState.updateCursor() called internally
    → 'presence:updated' emitted
    → Presentation layer re-renders remote cursor
```

The `SessionLog` acts as the single ingestion point for both local and remote events. `PresenceState` subscribes to it and maintains the live per-actor view.
