# Per-node edge index for graph-headless — intended change, not done

Date: 2026-10-11
Status: **proposal, audited, nothing changed in this repo.** Found while adding an event's neighbourhood to
wity-system's simulation (wity-system commits `cbb1428`, `5b254a3`), which had to work around the gap.

## The gap

"Edges of this node" is answered by scanning every edge, on every call:

- `core/graph-traversal.js` — `getOutgoingEdges` / `getIncomingEdges` / `getEdgesOfNode` are
  `[...edges.values()].filter(...)`.
- `GraphAbstract` — `getOutgoing` / `getIncoming` / `getEdgesOf` call those helpers; `reachable()` calls
  `getOutgoing` once per node visited; `core/graph-algorithms.js` (`propagate`, `reachable`, `shortestPath`,
  `allPaths`) calls `getOutgoing` / `getIncoming` once per node visited. A traversal therefore costs
  nodes × edges instead of nodes + edges.
- `GraphStore` — **already keeps an index** (`#adjacency`: nodeUid → Set<edgeUid>, maintained in `addEdge`,
  `removeEdge`, `#deleteNode`, `destroy`; used by `refreshEdgePathsOfNode`), but its `getEdgesOfNode` /
  `getOutgoingEdges` / `getIncomingEdges` don't use it — they scan too.

Measured on `GraphAbstract` (a chain with two outgoing edges per node):

| nodes / edges | one `getOutgoing` | `reachable(a0)` |
|---|---|---|
| 27 / 51 | 0.001 ms | 0.1 ms |
| 1 000 / 1 997 | 0.013 ms | 14 ms |
| 5 000 / 9 997 | 0.089 ms | 361 ms |

L2s work around it by rebuilding their own neighbour map from `getEdges()`: wity-system does so in three places
(`system-sim` `#graphCtx` each tick with neighbour predicates, `influence.js`, and the event neighbourhood).

## The change

1. `GraphAbstract`: add `#incident` (nodeUid → Set<edgeUid>), maintained at the five places edges change —
   `addEdge` (add only; an update keeps its endpoints), `removeEdge`, `removeNode` (cascade), `hydrate`, and through
   `hydrate`, `clone`. `getOutgoing` / `getIncoming` / `getEdgesOf` read it and resolve uids through `#edges`.
2. `GraphStore`: have the three lookups read the `#adjacency` it already maintains.
3. The exported helpers `getOutgoingEdges(uid, edgeMap)` etc. stay exactly as they are — public API over a raw map.

## What must hold (audited 2026-10-11)

- **Order.** Results come back in edge-insertion order and a consumer depends on it (wity-game takes
  `getEdgesOf(...)[0]`). One Set of incident edge uids per node — filtered by direction for outgoing / incoming —
  keeps exactly that order, including across remove + re-add (both structures move it to the end) and an update
  (`Map.set` on an existing key keeps its place).
- **Updated edges.** `addEdge` on an existing uid stores a new object (`{ ...existing, data }`), so the index must
  hold uids, not edge objects. It also ignores new endpoints on such a call (existing quirk) — endpoints of a stored
  edge never change, which is what keeps an index valid.
- **No in-place endpoint edits.** No consumer on this machine reassigns `srcUid` / `targetUid` on an edge from these
  classes (the only hits are the legacy `directed-graph` code, which doesn't use them).
- **`hydrate`** stores snapshot edges as given, without checking their nodes exist — index by the uids as given.
- **Self-loops.** `getEdgesOf` returns an edge whose src and target are the same node once.
- **Returned arrays are new** on every call today; keep that (consumers only read them, but it is the contract).

Consumers of the lookups on this machine: wity-system (`propagation.js`, `SystemGraph.getOutgoing/getIncoming`, the
app's asset inspector), wity-workbook (`sheet-state.js`, `recalc/topo-sort.js`), wity-game (`game-state.js`,
`world-relations.js`), wity-dial (`EnvironmentGraph.js`), the knowledge-graph views in wity-app and
wity-thought-player (`GraphStore.getEdgesOfNode`), wity-agent-builder.

## Before doing it

- **This package has no tests.** Write tests that pin today's behaviour first (every lookup's result and order after
  each kind of change), green on the unchanged code; then a randomised comparison of indexed vs scanned results over
  long add / update / remove / removeNode / hydrate sequences.
- **Consumers load `dist/`** (committed; the only thing shipped from 0.2.17). Rebuild (`npm run build`) and publish
  for the change to exist anywhere.
- **Versions in use:** 0.2.13 (wity-workbook), 0.2.16 (wity-system, wity-app, wity-notebook-viewer, wity-rkf,
  wity-authoring, wity-mcp, vritti-knowledge), 0.2.17 (vritti-ideator, the CLI's `~/.wity/domains`).
- `packages/graph-headless` is a **submodule**; the parent repo had uncommitted changes (submodule pointer,
  `package-lock.json`) before this note was written.

## Not part of this

The cost of copying each neighbour's signals onto a simulation event (wity-system) is not an index problem and
stays; `eventNeighbours: false` turns it off.
