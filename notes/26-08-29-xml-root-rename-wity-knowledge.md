# XML Root Element Rename: `<wity-graph>` to `<wity-knowledge>`

Date: 2026-08-29

## Decision

The XML serialization root element for graph-headless was renamed from `<wity-graph>` to `<wity-knowledge>`.

## Reasoning

### The naming principle

The XML root element should name the **domain representation**, not the platform layer and not the library.

The Wity platform has 5 layers:

```
Affordance → Composition → Chain of Thought → Memory → Inference
```

Each representation layer's XML serialization names **what that layer represents** — i.e. the domain concept, not the platform abstraction:

| Platform layer | Domain representation | XML root element | Library |
|---|---|---|---|
| Composition | Scene | `<wity-scene>` | wity-scene |
| Chain of Thought | Knowledge | `<wity-knowledge>` | wity-graph |

### Why not `<wity-graph>`

`wity-graph` names the **library** (`@wity/graph-headless`), not the domain. This breaks parity with `<wity-scene>` — the scene-core library is called `wity-scene`, but its root element is `<wity-scene>` because "scene" happens to name both the library and the domain. For graph-headless, the library name (`graph`) diverges from the domain it represents (`knowledge`).

### Why not `<wity-thought>`

`wity-thought` was considered but rejected. "Thought" names the **platform layer** (Chain of Thought), not the domain representation. This would be the same mistake as naming `<wity-scene>` as `<wity-composition>` — "composition" is the platform layer, "scene" is the domain representation.

### Why `<wity-knowledge>`

The field names in the platform confirm this:
- `sceneGraph` = **scene** + Graph → root element `<wity-scene>`
- `knowledgeGraph` = **knowledge** + Graph → root element `<wity-knowledge>`

The pattern is consistent: the field name's first word is the domain term, which becomes the root element name.

## Files changed

- `packages/graph-headless/serializer/serialize.js` — root element open/close tags, docstring XML example
- `packages/graph-headless/serializer/parse.js` — tagName validation, error messages, docstrings
- `docs/packages/graph-headless.md` — XML example
- `docs/public/llms-full.txt` — XML format description

## Migration

This is a breaking change to the XML format. Any previously serialized `<wity-graph>` documents will fail to parse with the updated `parse()` function. Consumers holding stored XML should update the root element tag name.
