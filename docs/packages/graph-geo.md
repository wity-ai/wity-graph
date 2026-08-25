# @wity/graph-geo

Spatial projection layer. Projects nodes from any coordinate system to canvas pixel positions via pluggable projection adapters. Works with geographic maps, floor plans, orbital views, PCB layouts, game maps — anything that can produce a 2D pixel projection.

```js
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';
```

---

## Concept

In a standard wity-graph setup, `PanZoomState` owns the viewport transform and the layout engine positions nodes in abstract canvas space. In a spatially-backed setup, an **external system** (map library, CAD viewer, game engine) owns the viewport.

`graph-geo` bridges this: it takes a `GraphStore` (same topology, same typed nodes/edges) and projects node positions from spatial coordinates to canvas x/y using whatever system is in use. The graph's traversal, selection, events, ontology — all unchanged.

```
┌─────────────────────────────────────────────────────────┐
│  Spatial system (map / CAD / game engine / viewer)      │
├─────────────────────────────────────────────────────────┤
│  graph-geo                                              │
│  GeoProjection · GeoGraphState · SpatialIndex           │
├─────────────────────────────────────────────────────────┤
│  graph-headless                                         │
│  GraphStore / GraphAbstract · Ontology · Traversal      │
└─────────────────────────────────────────────────────────┘
```

---

## Setup — Geographic (Mapbox)

```js
import { GraphStore, registerNodeType } from '@wity/graph-headless';
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';

registerNodeType('valve', {
    label: 'Valve',
    layout: { xSpacing: 0, ySpacing: 0, width: 40, height: 40 },
    ports: {
        inputs:  [{ id: 'in',  side: 'input',  yFraction: 0.5, xOffset: 0 }],
        outputs: [{ id: 'out', side: 'output', yFraction: 0.5, xOffset: 0 }],
    },
    dataSchema: {
        pressure: { type: 'number', unit: 'kPa' },
        status:   { type: 'enum', values: ['open', 'closed', 'partial'] },
    },
});

const store = new GraphStore();
const projection = new GeoProjection({
    project:   (lat, lon) => map.project([lon, lat]),
    unproject: (x, y)     => {
        const ll = map.unproject([x, y]);
        return { a: ll.lat, b: ll.lng };
    },
});
const geo   = new GeoGraphState(store, projection);
const index = new SpatialIndex({ cellSize: 100 });

store.addNode({
    uid:  'V_001',
    type: 'valve',
    data: { lat: -19.158, lon: 146.851, pressure: 320, status: 'open' },
});

map.on('move', () => {
    geo.reproject();
    index.build(store.getNodes());
});
```

## Setup — Floor plan (metric coordinates)

```js
const SCALE = 50;  // 50px per meter
const projection = new GeoProjection({
    project:   (mX, mY) => ({ x: mX * SCALE, y: mY * SCALE }),
    unproject: (x, y)   => ({ a: x / SCALE, b: y / SCALE }),
});

// coordFields tells GeoGraphState which node.data fields to read
const geo = new GeoGraphState(store, projection, { coordFields: ['mX', 'mY'] });

store.addNode({ uid: 'machine-1', type: 'cnc', data: { mX: 12.5, mY: 8.3 } });
canvasEl.addEventListener('resize', () => geo.reproject());
```

## Setup — Game map (tile coordinates)

```js
const geo = new GeoGraphState(store, projection, { coordFields: ['tileX', 'tileY'] });
store.addNode({ uid: 'tower-1', type: 'guard-tower', data: { tileX: 42, tileY: 17 } });
```

---

## GeoProjection

Pluggable coordinate adapter. Wraps any spatial system's projection behind a uniform two-function interface. The meaning of the two input coordinates depends on the system:

| System | a | b |
|---|---|---|
| Geographic | lat | lon |
| Floor plan | metersX | metersY |
| Orbital | azimuth | elevation |
| Game map | tileX | tileY |
| PCB | mmX | mmY |

```js
const projection = new GeoProjection({ project, unproject });
```

| Parameter | Type | Description |
|---|---|---|
| `project` | `(a, b) => { x, y }` | Spatial coordinates to canvas pixels |
| `unproject` | `(x, y) => { a, b }` | Canvas pixels to spatial coordinates |

### Methods

| Method | Returns | Description |
|---|---|---|
| `project(a, b)` | `{ x, y }` | Forward projection |
| `unproject(x, y)` | `{ a, b }` | Inverse projection |

---

## GeoGraphState

Connects a `GraphStore` to a `GeoProjection`. Extends `EventBus`.

```js
const geo = new GeoGraphState(store, projection, options?);
```

| Option | Type | Default | Description |
|---|---|---|---|
| `coordFields` | `[string, string]` | `['lat', 'lon']` | Names of the two coordinate fields on `node.data`. First → arg `a` of `project(a, b)`, second → arg `b`. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `reproject()` | — | Re-derive all node x/y from their spatial coordinate fields. Also re-projects edge waypoints. Emits `'geo:reprojected'`. |
| `setProjection(projection)` | — | Replace the projection adapter |
| `project(a, b)` | `{ x, y }` | Convenience forward projection |
| `unproject(x, y)` | `{ a, b }` | Convenience inverse projection |

### Node data convention

Nodes must carry spatial coordinates in their `data` field using the field names specified in `coordFields`:

```js
// Default (geographic): coordFields = ['lat', 'lon']
store.addNode({ uid: 'V_001', type: 'valve', data: { lat: -19.158, lon: 146.851 } });

// Floor plan: coordFields = ['mX', 'mY']
store.addNode({ uid: 'pump-1', type: 'pump', data: { mX: 5.2, mY: 12.8 } });
```

Nodes without the specified coordinate fields are skipped during reprojection.

### Edge waypoints

Edges with `data.waypoints` containing the same coordinate fields are also re-projected:

```js
store.addEdge({
    srcUid: 'V_001', targetUid: 'V_002', type: 'pipe',
    data: {
        waypoints: [
            { lat: -19.159, lon: 146.852 },
            { lat: -19.160, lon: 146.853 },
        ],
    },
});
```

After `reproject()`, each waypoint gains `x` and `y` fields — ready for `computePolylinePath()`.

### Events

| Event | Payload | When |
|---|---|---|
| `geo:reprojected` | `{ count }` | After `reproject()` — `count` is number of nodes updated |

---

## SpatialIndex

Grid-based spatial index for efficient point and rect queries at scale. Replaces brute-force iteration for graphs with thousands of spatially-positioned nodes.

```js
const index = new SpatialIndex({ cellSize: 100 });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `cellSize` | `number` | `100` | Grid cell size in pixels |

### Methods

| Method | Returns | Description |
|---|---|---|
| `build(nodes)` | — | (Re)build the index from node positions. Call after every `reproject()`. |
| `queryPoint(x, y, radius?)` | `node[]` | Nodes within `radius` px of point, sorted nearest-first. Default radius: 20. |
| `queryRect(x1, y1, x2, y2)` | `node[]` | Nodes whose bounding box intersects the rectangle. |

### Properties

| Property | Type | Description |
|---|---|---|
| `size` | `number` | Number of indexed nodes |
| `cellCount` | `number` | Number of occupied grid cells |
