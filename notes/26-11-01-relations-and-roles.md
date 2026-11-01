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

## 2. L1 wity-graph — a relation, its state and its look, apart

- **An edge's `type` is its relation.** No new field: `GraphAbstract` already treats it so (uid per type triple).
- **A relation id** is a core relation or `<namespace>:<name>`. wity-graph exports the grammar (`isRelationId`) and a
  small **core set** grounded in OBO's Relation Ontology, general to any graph:
  `part-of` / `has-part`, `precedes`, `causes`, `depends-on`, `derives-from`, `participates-in`.
  Plus `related` (the plain link — today's `default`), so every existing edge has a relation without changing.
- **Each L2 declares its namespace's relations** (id, label, inverse, which node kinds it joins) — a declaration it
  passes in, not a mutation of a shared object. `registerLinkType` is replaced; nothing is registered globally.
- **Edit state is not a relation.** `placeholder` (edge and node) becomes a state of the store — a link or node being
  drawn — beside `type`, so a link drawn as `causes` is still `causes` while being drawn.
- **Look is not ontology.** `style` leaves `LINK_TYPES`; whoever draws resolves it from the relation (a theme for
  wity-app and the viewer, the host's own for others). `GraphStore` keys an edge by its relation triple, as
  `GraphAbstract` does, so the two stores agree.
- Un-namespaced ids already used by L2s (`contains`, `depends-on`, `reads`, `writes`, workbook's): each becomes a core
  relation where it is one (`depends-on`; `contains` = `has-part` — an alias read, never rewritten in saved data) or a
  declared relation of its package. **Step 1 lists every edge type in use before the core set is frozen** — no guess.

## 3. L2.5 rkf — link roles and card roles

**A link's role** — what a connector means.
- A connector gets `role`: a relation id. The vocabulary rkf-core offers is wity-graph's core relations plus rkf's own
  argument relations — `supports`, `contradicts`, `example-of`, `refines`, `answers` — plus `<ns>:<name>` extensions
  (`script:cuts-to`, `script:flashback`). An un-namespaced id that is neither is refused, so a typo never becomes a
  role; an unknown namespaced one is kept and drawn plain. One source: `LINK_ROLES` in rkf-core, every command's list
  and description built from it (as `ROLES` / `THEMES`).
- **Read, never migrated:** a connector's `data.relationship` that names a known role becomes `role` when a document
  is read; any other value stays in `data`, untouched. `data` remains for what really is a host's own, never meaning.
- **Connectors become edges in the document's graph** (doc-graph.js): an edge from card to card, `type` = its role,
  `data` = its ports, colour, width, uid. Lossless both ways (round-trip test over every saved shape, including no
  role). Then a thoughtbook's relations can be traversed and analysed like any graph's.

**A card's role** — what a card is in the document.
- `card.role`: an id from `CARD_ROLES` (core, small: `claim`, `evidence`, `question`, `definition`, `example`,
  `summary`) or `<ns>:<name>`. Each role says its BFO kind (continuant or occurant) — the card node's kind follows it.
- **A role's details are typed fields the role declares** (`card.fields`, checked against the role), never a free
  metadata bag — the bag is the mistake §1 records on connectors.
- One place each: a **cell's** role is what a part of a card means; a **card's** role is what the whole card is. A
  role never sits on both.
- Old readers ignore `role` and draw plain (as with cell roles); unknown roles are never deleted on load.

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

1. **L1:** list every edge type in use (graph-headless users in hais-pkgs and wity-app); relation grammar + core set;
   split state and look out of `LINK_TYPES`; `GraphStore` keyed by relation; replace `registerLinkType`. Tests:
   every existing edge reads with an unchanged relation; drag-to-link works as before.
2. **L2.5 rkf-core:** `LINK_ROLES`, `CARD_ROLES`, role fields; connector `role` (read-upgrade from
   `data.relationship`); connectors as edges in doc-graph (round-trip over saved boards). A major version (as 2.0.0).
3. **L3 wity-authoring:** commands `link.role.set`, `card.role.set` (lists built from rkf-core), `card.read` /
   `doc.outline` show roles; the guide. MCP and every assistant get them through authoring.
4. **wity-app + viewer:** themes draw link and card roles; pickers.
5. **Script:** the `script:` namespace and the dialogue-line decision; guidance `section`; note `source`;
   "shots from a scene"; the Script tab on the thoughtbook; exhibit.

## 7. Open, to decide before building

- The core relation set's final list (after step 1's inventory).
- A dialogue line: cell role or text style with a speaker (§5).
- Whether a card role may also be inferred (e.g. a card holding only a character embed) or is only ever set.
