# Ontology

## Why ontology?

The node type system is grounded in [Basic Formal Ontology (BFO)](https://basic-formal-ontology.org/) — not dogmatically, but as a practical distinction that turns out to map cleanly onto real-world graph content.

The key insight BFO gives us: **not all things exist the same way through time**.

- Some things *persist* — a concept, a document, a person. They are fully present at any moment you examine them.
- Some things *unfold* — a process, an event, an action. They exist only by playing out over time.

This distinction, continuants vs. occurants, turns out to be the exact distinction you need for knowledge graphs, agentic workflows, and collaborative canvases. It's not arbitrary naming.

---

## Node types

### Continuant

A thing that persists through time. It retains identity from moment to moment. You can look at it now and it is complete — it does not need to "happen" to exist.

**Examples:** a concept, a document, a person, an idea, a task, a resource, a belief.

**In the graph:** the primary building block. Most nodes in a knowledge graph are continuants.

```
Layout: 240 × 272 px
Ports:  'in' (left, input), 'out' (right, output)
Style:  color-primary
```

### Occurant

A process or event that unfolds through time. It is not fully present at any single moment — it has a beginning, a middle, and an end.

**Examples:** a brainstorming session, an agent executing a task, a computation running, a meeting.

**In the graph:** half the height of a continuant. Has a lifecycle: created → running → completed / errored / cancelled. The `graph-player` knows how to animate these lifecycle transitions.

```
Layout: 240 × 136 px
Ports:  'in' (left, input), 'out' (right, output)
Style:  color-secondary
```

**Occurant lifecycle fields** (all optional, epoch ms):

| Field | Meaning |
|---|---|
| `createdAt` | When the node appears in the graph |
| `startedAt` | When execution / the process began |
| `completedAt` | When it succeeded |
| `erroredAt` | When it failed |
| `cancelledAt` | When it was cancelled |

### Placeholder

An ephemeral node that exists only during drag-to-link interactions. It has no visual presence (2×2 px, invisible). Created by `PlaceholderManager.start()`, destroyed on commit or cancel.

You do not create placeholders manually. The `PlaceholderManager` manages them.

---

## Port model

Edges do not connect directly to nodes — they connect to named **ports** on nodes. Ports are declared per node type and define:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | Unique within the node type |
| `side` | `'input' \| 'output'` | Which side of the node (left / right) |
| `yFraction` | `0–1` | Vertical position as a fraction of node height |
| `xOffset` | `number` | Pixel inset from the edge |
| `style` | `object` | Color, radius for port dot rendering |

The standard types each have two ports: `'in'` (input, left) and `'out'` (output, right).

Dynamic overflow ports are created automatically when all declared input ports are connected — you never need to manage this manually.

---

## Link types

| Type | Appearance | Purpose |
|---|---|---|
| `default` | Darkgray, 2px solid | Standard directed connection |
| `placeholder` | Darkgray, 2px dashed | Tentative link during drag-to-link |
| `semantic` | Indigo | Explicitly typed relationship (reserved for rich linking) |

---

## Extending the ontology

Register custom node types at runtime. No code changes required in the library.

```js
import { registerNodeType } from '@wity/graph-headless';

registerNodeType('decision', {
  layout: {
    width:    200,
    height:   80,
    xSpacing: 280,
    ySpacing: 120,
  },
  ports: [
    { id: 'in',  side: 'input',  yFraction: 0.5, xOffset: 20, style: { color: '#888', radius: 4 } },
    { id: 'yes', side: 'output', yFraction: 0.3, xOffset: 5,  style: { color: '#4c8', radius: 4 } },
    { id: 'no',  side: 'output', yFraction: 0.7, xOffset: 5,  style: { color: '#e44', radius: 4 } },
  ],
  style: {
    nodeClass:      'decision-node',
    containerClass: 'decision-container',
  },
});
```

Register custom link types:

```js
import { registerLinkType } from '@wity/graph-headless';

registerLinkType('dependency', {
  style: {
    stroke:       '#f59e0b',
    strokeWidth:  2,
    strokeDash:   '4 2',
  },
});
```

Both registrations take effect immediately for any nodes/edges added after the call. Existing nodes are unaffected until they are re-rendered.

---

## Ontological grounding of the session model

The actor/session model introduced in `ActorRegistry`, `SessionLog`, and `PresenceState` is also ontologically coherent:

- **Actor** — an independent continuant. It persists through time and bears properties (name, role, color).
- **Session** — an occurant. It begins, unfolds (as a stream of events), and ends. It is the temporal container for everything that happened.
- **Session events** — parts of the occurant. Each event is a sub-process: a node was moved, a cursor was positioned, a status changed.

The graph's occurant nodes (tasks, agent actions) are the *semantically significant* subset of session events — the ones worth promoting to visible graph entities. The `SessionLog` is the superset from which they are projected.
