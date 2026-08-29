# Spreadsheet ontology and wity-workbook viability on wity-graph

Date: 2026-08-27

---

## 1. Spreadsheet ontology — four entities

A spreadsheet is an **Acyclic Directed Graph mapped onto a Cartesian Coordinate Matrix**. Four ontological entities:

### Canvas
- The 2D grid itself — rows x columns forming a Cartesian coordinate matrix
- Addressed by (col, row) pairs: A1, B3, Z100
- The spatial embedding that gives cells their visual position and identity
- Multiple canvases = multiple sheets = a Workbook

### Cell
- The primitive unit occupying one (col, row) position on the canvas
- A cell is a **container** — it holds either a raw Value or a Formula, never both simultaneously
- A cell without content is empty but still exists as an addressable slot
- Cells have formatting metadata (font, color, borders, number format) orthogonal to their value

### Value
- The visible, resolved state of a cell
- If the cell contains a literal, the value IS the literal
- If the cell contains a formula, the value is the RESULT of evaluating that formula
- Types: number, string, boolean, date, error
- The value is what the user sees and what other formulas reference

### Formula
- A recipe (expression) that produces a Value by referencing other cells
- `=SUM(A1:A10)` creates directed edges from A1..A10 → this cell
- Formulas create the DAG — every cell reference is a dependency edge
- The DAG must be acyclic (circular reference = error)
- Formulas have range semantics: `A1:A10` expands to 10 individual cell references

### The DAG

The dependency graph is implicit in the formulas. If C1 = A1 + B1, then:
- Edge: A1 → C1 (A1 is a dependency of C1)
- Edge: B1 → C1 (B1 is a dependency of C1)
- Recalculation order = topological sort of this DAG
- Dirty propagation: changing A1 marks C1 (and all downstream dependents) dirty

---

## 2. Mapping spreadsheet entities to wity-graph primitives

| Spreadsheet entity | wity-graph primitive | Notes |
|---|---|---|
| Cell | Node (GraphAbstract vertex) | `uid: 'A1'`, typed as `'cell'` |
| Formula dependency | Edge (GraphAbstract directed edge) | `srcUid: 'A1', targetUid: 'C1', type: 'depends-on'` |
| Cell type/format | dataSchema on registerNodeType | `dataSchema: { value: { type: 'number' }, format: { type: 'string' } }` |
| Grid position | graph-geo with `coordFields: ['col', 'row']` | Trivial projection: `(col, row) → (col * cellWidth, row * cellHeight)` |
| Dependency DAG | GraphAbstract traversal | `reachable()`, `getOutgoing()`, `getIncoming()` give recalc order and dirty propagation |
| Circular reference detection | Cycle detection on GraphAbstract | Directed edge model supports this |
| Sheet | A separate GraphAbstract instance or a partitioned subgraph | |
| Workbook | Container of sheets | |

What wity-graph covers: DAG representation, typed nodes/edges, topological traversal, dependency queries, grid-as-spatial-projection, typed cell schemas.

What wity-graph does NOT cover (consumer-domain logic): formula parsing, range expansion (`A1:A10` → 10 refs), the recalc engine itself, cell formatting rules, multi-sheet cross-references (`Sheet2!B4`), built-in function library (SUM, VLOOKUP, etc.).

---

## 3. The wity-scene structural parallel

### wity-scene internal architecture

wity-scene is a composable layered library with internal packages:

```
scene-core          — parse(xml) → WityScene, evaluate(scene, t) → ComputedFrame, serialize, validate
                      Pure computation heart. Deterministic. No side effects. No global state.
scene-headless      — SceneStore, SelectionManager, HistoryManager, commands (mutable authoring)
scene-player        — HeadlessPlayer (drives evaluate() at playback rate via RAF)
scene-edit          — structural mutations on parsed scenes
scene-to-video      — frame-by-frame render → FFmpeg MP4 (server/lambda)
scene-compose       — full compositor via FFmpeg filter_complex (server/lambda)
scene-to-pdf        — snapshot → PDF
scene-to-pptx       — snapshot → PowerPoint
scene-render-utils  — shared shape paths, VFX presets
```

Key: `evaluate(scene, t) → ComputedFrame` is **internal** to wity-scene (lives in scene-core). It's a pure function — same input, same output, always. It returns resolved pixel data. Rendering-agnostic — the consumer decides target (HTML/CSS, Canvas 2D, SVG, FFmpeg, WebGL, etc.).

### External consumers of wity-scene

**jity-cinema** and **jity-slideshow** are separate libraries that peer-depend on wity-scene packages. They consume ComputedFrame output and wire it to Three.js rendering pipelines. They are domain-specific authoring/rendering environments built ON TOP of wity-scene — a layer above, not at the same level.

- jity-cinema: peer-depends on scene-core + scene-player. Adds Three.js WebGL renderer. Purpose: cinematic playback.
- jity-slideshow: peer-depends on scene-core + scene-render-utils. Adds Three.js depth-gallery spatial transforms. Purpose: immersive spatial slideshow.

### The three-level architecture (corrected)

The ecosystem has three distinct levels, not two. This applies to both wity-scene and wity-graph:

```
Level 1 — Representation libraries (composable, layered, rendering-agnostic primitives)
    wity-scene    (scene-core → scene-headless → scene-player → scene-edit → scene-to-video → ...)
    wity-graph    (GraphAbstract → GraphStore → graph-ui-compute → graph-player → graph-geo)

Level 2 — Domain libraries (stack-agnostic, isomorphic, domain-specific semantics)
    jity-cinema      — cinematic playback semantics on wity-scene
    jity-slideshow   — spatial slideshow semantics on wity-scene
    wity-workbook    — workbook/spreadsheet semantics on wity-graph
    wity-dialectics  — dialectics workflow semantics on wity-graph

Level 3 — Application widgets (framework-bound, UX-opinionated, consume domain libraries)
    jity-design-studio   — Muffin/React spatial editor, consumes jity-cinema/slideshow
    jity-video-studio    — Muffin/React temporal editor, consumes jity-cinema
    jity-exhibit         — read-only composition viewer, consumes jity-slideshow
    workbook-editor      — would consume wity-workbook
    dialectics-editor    — currently monolithic in wity-agent-builder, should thin down to consume wity-dialectics
```

**Key insight about the current dialectics-editor:** The dialectics editor in wity-agent-builder currently conflates Level 2 and Level 3 — domain logic (step types, yield flow, observe connections, dialectics workflow semantics) is entangled with the application widget (Muffin component, SVG rendering, popovers, inspector panel). The domain logic should be extracted into a stack-agnostic `wity-dialectics` library at Level 2. The widget then thins down to just consuming that library.

### Suite naming convention

The prefix signals which Wity AI platform suite the library belongs to:

| Suite | Prefix | Domain | Examples |
|---|---|---|---|
| **Wity** — Thinking Suite | `wity-` | Thinking, sense-making, reasoning, knowledge graphs | wity-graph, wity-scene, wity-workbook, wity-dialectics |
| **Jity** — Creative Suite | `jity-` | Content creation, video, design, media | jity-cinema, jity-slideshow, jity-design-studio, jity-video-studio |
| **Nity** — Coordination Suite | `nity-` | Workflow execution, operations, coordination | (workflow/ops libraries) |

`jity-cinema` and `jity-slideshow` are `jity-` because they add creative/media-domain semantics (cinematic playback, spatial presentation). They consume `wity-scene` (a Thinking-layer representation library) but their domain is creative output.

`wity-workbook` and `wity-dialectics` are `wity-` because they add thinking-domain semantics (structured reasoning via spreadsheets, structured reasoning via dialectics workflows). They consume `wity-graph` (also Thinking layer) and stay in the thinking domain.

### XML serialization as a general wity-graph capability

wity-scene has `parse(xml) → WityScene` and `serialize(scene) → xml` in scene-core — a general-purpose capability of the representation library, not tied to any specific consumer.

wity-graph needs the same: `serialize(graph) → xml` and `parse(xml) → graph` as a general-purpose capability in graph-headless. This would capture GraphAbstract's vertices + typed edges, node data, dataSchema registrations — the full graph state.

This is a representation-library-level concern (Level 1), not a consumer concern. Any Level 2 or Level 3 consumer benefits from it. The fact that wity-app's chainOfThought object might store the XML string in a `knowledgeGraph` field (analogous to Composition storing scene XML in `sceneGraph`) is a Level 3 application decision — not wity-graph's concern.

The pattern:
```
wity-scene serialize/parse   →  Composition.sceneGraph field (application stores it)
wity-graph serialize/parse   →  ChainOfThought.knowledgeGraph field (application stores it)
```

Both sides of this pattern: the serialization belongs to the library, the storage field belongs to the application.

---

## 4. Viability assessment: wity-workbook on wity-graph

### Why the parallel holds (structurally load-bearing, not cosmetic)

1. **GraphAbstract as dependency DAG** — formula references are literally directed edges. `A1 = B1 + C1` is `addEdge({ src: 'B1', target: 'A1' })` + `addEdge({ src: 'C1', target: 'A1' })`. This isn't an analogy — it's the actual data structure spreadsheets use internally.

2. **Topological traversal for recalc** — `reachable()` and the traversal primitives give you dirty propagation and recalculation order. Topological sort of the DAG is the classic spreadsheet recalc algorithm.

3. **dataSchema for typed cells** — number, string, date, boolean, enum map directly to cell value types.

4. **graph-geo for grid coordinates** — `coordFields: ['col', 'row']` with trivial projection. The grid IS a spatial projection. This isn't a hack — it's exactly what graph-geo was designed for (any coordinate system → canvas x/y).

5. **Cycle detection** — critical for circular reference errors. GraphAbstract's directed edge model supports this naturally.

6. **Event system** — `nodes:changed`, `edges:changed` give you reactive cell updates for free.

### What wity-workbook would add (genuine consumer-domain logic)

1. **Formula parser** — `"=SUM(A1:A10)"` → AST → dependency edges. The spreadsheet-domain equivalent of wity-scene's XML parser, but for formula expressions. This is substantial — operator precedence, function calls, range syntax, array formulas.

2. **Range expansion** — `A1:A10` → 10 individual cell references. Grid-specific addressing that the graph layer shouldn't know about.

3. **Recalc engine** — topological sort of dirty subgraph → evaluate in order → write computed values back. Uses GraphAbstract's traversal but adds evaluation semantics. Analogous to `evaluate(scene, t)` — a pure function: `evaluate(dag, dirtySet) → computedValues`.

4. **Built-in function library** — SUM, AVERAGE, VLOOKUP, IF, etc. The function vocabulary of the domain.

5. **Cell formatting** — display rules (currency, percentage, conditional formatting). Pure presentation metadata.

6. **Sheet/workbook container** — multi-sheet references (`Sheet2!B4`), named ranges, sheet-level operations.

### The purity test

wity-scene's `evaluate()` is a **pure function** — deterministic, no side effects, no global state. If wity-workbook's recalc engine follows the same discipline:

```
evaluate(dag, dirtySet) → computedValues
```

...that's a strong architectural signal that the parallel is real. The recalc engine takes the current DAG state, identifies what needs recomputation, evaluates in topological order, and returns resolved values. No mutations. No rendering. Consumer decides what to do with the results.

### Scope caveat

Spreadsheets are deceptively deep. Excel-compatible formula parsing alone (operator precedence, 400+ built-in functions, array formulas, volatile functions like NOW()/RAND(), implicit intersection) is a multi-year effort at parity. But the goal wouldn't be Excel parity — it would be a **workbook primitive**: a headless, stack-agnostic, DAG-driven computation grid that frameworks can render however they want. The same way wity-scene doesn't try to be After Effects — it's the representational and computational core that something like a video editor consumes.

---

## 5. Summary

The wity-workbook idea is structurally sound. The parallel to wity-scene → jity-cinema/jity-slideshow is load-bearing: wity-graph provides the representation primitives (DAG, typed nodes, spatial projection, traversal, events), and wity-workbook would add the domain-specific evaluation layer (formula parsing, recalc engine, range semantics) as an external consumer. The key architectural discipline: keep the recalc engine pure and rendering-agnostic, exactly as wity-scene keeps `evaluate()` pure and rendering-agnostic.
