# Relations and roles — what a link means, what a card is, and a script built on them

2026-11-01. A design, not yet built. One consolidated design across the layers; each package documents its own part
in its own docs when it is built. Read before changing links, connectors, card metadata or the video studio's Script tab.

Layers (as named everywhere): L1 wity-graph · L2 wity-system, wity-workbook, … · L2.5 wity-rkf (an L2 that embeds the
others) · L3 wity-authoring / wity-scene-authoring · L4 apps, MCP, CLI. Every L2 composes over wity-graph's primitives;
a primitive any of them needs belongs in wity-graph, and each L2 extends it for its domain.

## 1. What is there (verified in code, 2026-11-01)

**L1 wity-graph (graph-headless)**
- `GraphAbstract` (core/graph-abstract.js) — the data model: an edge is `{ uid, srcUid, targetUid, type, data }`; its
  uid is `${type}:${src}→${target}`, so several relations between the same two nodes are already supported. `type` is
  a free string: **the relation axis exists here, untyped by vocabulary.**
- `GraphStore` (core/graph-store.js) — the interactive store: `addEdge` keys an edge by `src-link-target` (one edge per
  pair, whatever its type), `placeholder` edges are keyed `placeholder-link-<src>`, and `style` is resolved from
  `LINK_TYPES` onto the edge.
- `ontology/link-types.js` — `LINK_TYPES = { default, placeholder, semantic }`, with `semantic` "reserved for future
  rich-linking". Three concerns on one field: **meaning** (semantic), **edit state** (placeholder — a link being drawn;
  headless state, but a state, not a relation) and **look** (style). `registerLinkType()` mutates a shared module-level
  object at runtime: two hosts on one page change each other's types.
- `ontology/node-types.js` — node types grounded in BFO: `continuant` (persists), `occurant` (unfolds in time),
  `placeholder` (same mix: an edit state among kinds).

**L2 users of edge types** (all un-namespaced strings today)
- rkf-core: `contains` (doc-graph.js — structure, with `{ rel, index }`), `depends-on`, `reads`, `writes`
  (dep-graph.js — derived, recomputed, never stored).
- wity-system: connection *types* are user-defined per map (system-core type-registry.js, `registerConnectionType`) —
  the vocabulary of the modelled system (a road, a pipe), data of that map, not ontology. Kept as it is (§4).
- wity-workbook: cells as typed nodes (notes/26-08-27-workbook-on-graph.md) — its edge types to be listed in step 1.

**L2.5 rkf-core — card links**
- Card links are **connectors**: `section.connectors[]` of `{ tag:'rkf-connector', _uid, from, fromPort, to, toPort,
  color, width, data }` (edit/edit.js `addConnector`). Meaning, when any, is `data.relationship` — "free-form; nothing
  branches on a fixed type". wity-mcp's `link_add` says the same (`data`, e.g. `{relationship:"causes"}`).
- In doc-graph.js connectors are **not edges**: `rkf-section`'s child collections are `vars, children`, so connectors
  ride as an array inside the section node's data. A thoughtbook's own relations between cards are invisible to its
  own graph (no traversal, no analysis over them).
- Cards: content, position, style (`card_style_set`: border and fill). Nothing says what a card *is*.
- Cell roles (notes in wity-rkf: 26-10-31-roles-and-themes.md): what a group inside a card means — `ROLES`, core +
  `<ns>:<name>` extensions, unknown never deleted on load, drawn by the theme. The pattern this design follows.

**L3 wity-scene-authoring + the video studio — two places a script lives**
- In the scene: a layer of role `script` holding `ws-note`s (dialogue, description, caption). The studio's Script tab
  (`ScriptTab`, `JityScriptEditor`) reads and writes them and seeds them from segments. Speech generation depends on
  them: `settings.speech[].says.line` is a dialogue note's id — its speaker must match the cast member, its word count
  gives a shot's length (commands/lifecycle/requests.js); the guide's "talking characters" recipe builds this.
- As guidance: `{ role: 'script', board }` (guidance.js) — a thoughtbook that guides the composition. Kept by the
  composer, told to the assistant every turn. **Nothing joins it to the notes**; the same words can be written twice
  and drift.
- jity-exhibit mounts the video studio widget read-only (ProjectExhibit.tsx) — the project page *is* the studio's
  Scene / Script / Storyboard tabs. It requires the composition's `cotRef` ("How this was made cannot be shown"
  without one) — a separate link from the `script` guidance.

## 2. L1 wity-graph — relations, a declared vocabulary (built: graph-headless `ontology/relations.js`)

**Inventory (step 1, 2026-11-01)** — every edge type in use, and who uses the link-type API:
- Edge types are domain names, not relations, and many are user data: wity-system stores each **user-defined
  connection type** (a road, a pipe) as `edge.type` (system-graph.js); its formalisms use `contains`, `then`; rkf
  `contains`, `depends-on`, `reads`, `writes`; workbook `depends-on`; wity-game `at`, `seat`; tests `arc`,
  `performs`, `loop`. Interactive canvases: agent-builder `observe`, `yield`, `compose-observe`, `compose-flow`;
  wity-ideation and wity-thought-player `composition-image|video|audio` (the same three, defined twice).
- `registerLinkType` callers: wity-ideation, wity-thought-player, wity-agent-builder. `GraphStore` users:
  wity-app knowledge-graph-v2 and intent-journeys, wity-thought-player, wity-agent-builder. **The thoughtbook canvas
  does not use GraphStore** — its card links are rkf connectors (§1).

**So an edge's type cannot become a governed relation in the data model** — that would refuse a system map's own
types and every domain name above. Instead (as `checkJoins` already works — rules passed in, nothing global):
- `GraphAbstract` is unchanged: any string is an edge type.
- `relations({ extensions, joins })` builds a frozen **vocabulary** a domain checks *its own authored links* with:
  the core relations (`related`, `part-of`/`has-part`, `precedes`/`preceded-by`, `causes`, `depends-on`,
  `derives-from`, `participates-in`, `located-in` — each with its RO/BFO id) and the domain's own,
  `<namespace>:<name>`, each declared once with its label, inverse, and the kinds of node it may join. `problems(id)`
  refuses a typo; `unknownExtensions: 'keep'` lets an older reader keep a newer writer's namespaced relation.
  `joinRules()` is what `checkJoins` takes — one definition of joins, not two.
- Exported: `CORE_RELATIONS`, `relations`, `isRelationId`, `namespaceOf`. Tests: test/relations.test.js.

**GraphStore's link types — a separate cleanup, not on the thoughtbook's path.** `LINK_TYPES` mixes meaning
(`semantic`), edit state (`placeholder`) and look (`style`), keys an edge by its pair only, and `registerLinkType`
mutates a shared object. Its users are the four interactive canvases above, none of them the thoughtbook. Fixing it
(state beside the type, look resolved by the host, a store given its link looks instead of a global registry, the
twice-defined composition link types made one) changes those canvases and is done as its own step, each canvas
checked in a browser — never folded into the relations work.

## 3. L2.5 rkf — link roles and card roles (built: rkf-core 3.0.0, edit/link-roles.js, edit/card-roles.js)

**A link's role** — what a connector means: `connector.role`.
- The vocabulary is wity-graph's: `LINK_ROLES` = its core relations plus `RKF_RELATIONS` — `rkf:supports` /
  `rkf:supported-by`, `rkf:contradicts` (its own inverse), `rkf:example-of`, `rkf:refines`, `rkf:answers` — built at
  load by `relations` from `@wity/graph-headless/relations` (≥ 0.4.1): a stateless leaf rkf-core imports directly,
  so the vocabulary is a constant every command's description is built from, and an old board reads the same
  everywhere. The graph library itself (GraphAbstract, the codec) stays injected with `setGraphProvider`.
  (First built through the injection; that left the vocabulary absent at load and an old board's reading dependent on
  what was injected — replaced before release.)
- `addConnector({ role })`, `setConnectorRole`, `updateConnector({ role })` check it (`linkRoleProblems`): a typo is
  refused and nothing changes; a namespaced role of your own is kept and drawn plain.
- **Saved before roles:** `normalizeDoc` reads a `data.relationship` that names a relation (`causes`; rkf's by name,
  `supports` → `rkf:supports`) as the role and takes it out of `data`, so the meaning is said once. Any other value
  (`child`, `has`) stays in `data`; a role already given wins and nothing is dropped.
- **Where links are saved does not change.** Connectors stay in their section (`section.connectors`, saved in the
  section node's data) with everything they carry (label, endCap, colour…). vritti-knowledge's extractor reads them
  there, and an older reader keeps a connector's `role` as one of its keys. A graph of a thoughtbook's relations,
  when one is needed, is derived from them (as rkf derives `depends-on` / `reads` / `writes`), never stored twice.

**A card's role** — what a card is: `card.role`, `CARD_ROLES` (claim, evidence, question, definition, example,
summary — each with its BFO kind), or `<ns>:<name>`; `setCardRole`, `cardRoleProblems`; never dropped on load.
- One place each: a cell's role is what a part of a card means; a card's role, what the whole card is.
- **Fields of a role** (a `script:scene`'s place, time, cast) come with the first role that has them (§5) — typed,
  declared by the role, never a free bag. No core role has fields, so none is built before it is needed.

**Who reads connectors' meaning today, all moving to `role` in step 3–4, in one release with rkf-core 3:**
wity-app's connector inspector (the `data` bag editor), wity-authoring (`link.add` description, `card.read` /
`doc.outline`, the assistant context's `relationship=` attribute), wity-mcp's boards.ts (the raw XML guide's
`data.relationship` example), the viewer and the app's connector layer (draw `label`). No consumer takes rkf-core 3
before these are updated with it — otherwise a relationship read as a role would vanish from what they show.

## 4. What stays as it is

- wity-system's connection types are the vocabulary of the modelled system (data of that map). They are not merged
  into relations. Open: whether a connection type may *declare* the relation it is (a `feeds` connection is a
  `causes`), so analyses can read a map's meaning — decided when wity-system needs it, not now.
- Cell roles, themes, text styles — unchanged.

## 5. The script on these primitives (L2.5 vocabulary, L3 flow)

**The `script:` namespace** (rkf-core, an extension namespace; promoted to core only if needed beyond scripts):
- card roles: `script:scene` (occurant; fields: `place`, `time` day/night/…, `setting` interior/exterior, `cast` — ids
  of character entities), `script:character` (continuant; field: `entity` — the character's id in wity-characters).
- link roles: `script:cuts-to`, `script:flashback`; order uses core `precedes`.
- a line of dialogue: **open** — a block that carries a speaker. Options: a cell role `script:line` (but a role has no
  fields today), or a text style `dialogue` with a `speaker` attribute on the block. To decide in this design before
  building; whichever it is, every editor (wity-app, the Script tab, chat, MCP) reads the same data.

**A series** is one script thoughtbook (the bible: premise, characters, world; a section per episode). Each episode is
its own composition. Guidance gains an optional **section**: `{ role: 'script', board, section }` — "this episode is
this section". Episodes are joined through their script; no series field.

**Script → scene, one direction, linked back** (wity-scene-authoring):
- A dialogue note gains `source: { board, card, block }` — the line of the script it says.
- "Shots from a scene" (a command, L3): from a `script:scene` card, the notes for its lines (speakers from the cast,
  cast from its characters) and, at the author's choice, media asked for each shot — a storyboard image, a draft
  clip or the final one. Each shot's media keeps the scene card it came from.
- A note whose source line has changed since is **out of date**: shown so, updated on request. Notes keep their role
  in speech (timing, the shot that says them); the script keeps the words. Nothing is written twice by hand.
- The Script tab edits the script thoughtbook (a script-shaped view of the same document); a composition with no
  script guidance keeps today's notes-only tab until one is linked — no regression for existing compositions.
- jity-exhibit: what the project page needs (today `cotRef`) is reconciled with the `script` guidance in the same step.

## 6. Order of work — each step green before the next, servers before apps

1. **L1 (done):** the inventory (§2); `relations` in graph-headless — additive, no existing behaviour changed.
   1b (separate, later): GraphStore's link types (§2), each canvas checked in a browser.
2. **L2.5 rkf-core (done, 3.0.0, not yet released):** link roles, card roles, the read of `data.relationship`;
   graph-headless 0.4.1 released (relations as its own entry). Released together with steps 3–4's consumers, never before.
3. **L3 wity-authoring:** commands `link.role.set`, `card.role.set` (lists built from rkf-core), `card.read` /
   `doc.outline` show roles; the guide. MCP and every assistant get them through authoring.
4. **wity-app + viewer:** themes draw link and card roles; pickers.
5. **Script:** the `script:` namespace and the dialogue-line decision; guidance `section`; note `source`;
   "shots from a scene"; the Script tab on the thoughtbook; exhibit.

## 7. Open, to decide before building

- A dialogue line: cell role or text style with a speaker (§5).
- Whether a card role may also be inferred (e.g. a card holding only a character embed) or is only ever set.
