# @wity/graph-geo

Geospatial projection layer. Maps geographic coordinates (lat/lon) to canvas pixel positions via pluggable projection adapters. Works with any map library.

```js
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';
```

---

## Concept

In a standard wity-graph setup, `PanZoomState` owns the viewport transform and the layout engine positions nodes in abstract canvas space. In a geospatial setup, the **map library** owns the viewport — pan, zoom, and projection are all the map's domain.

`graph-geo` bridges this: it takes a `GraphStore` (same topology, same typed nodes/edges) and projects node positions from `data.lat`/`data.lon` to canvas x/y using whatever map library is in use. The graph's traversal, selection, events, ontology — all unchanged.

```
┌─────────────────────────────────────────────────────────┐
│  Map Library (Mapbox / Leaflet / OpenLayers / Cesium)   │
├─────────────────────────────────────────────────────────┤
│  graph-geo                                              │
│  GeoProjection · GeoGraphState · SpatialIndex           │
├─────────────────────────────────────────────────────────┤
│  graph-headless                                         │
│  GraphStore / GraphAbstract · Ontology · Traversal      │
└─────────────────────────────────────────────────────────┘
```

---

## Setup

```js
import { GraphStore, registerNodeType } from '@wity/graph-headless';
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';

// 1. Register domain-specific node types
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

// 2. Create store and geo layer
const store = new GraphStore();
const projection = new GeoProjection({
    project:   (lat, lon) => map.project([lon, lat]),
    unproject: (x, y)     => {
        const ll = map.unproject([x, y]);
        return { lat: ll.lat, lon: ll.lng };
    },
});
const geo   = new GeoGraphState(store, projection);
const index = new SpatialIndex({ cellSize: 100 });

// 3. Add geo-positioned nodes
store.addNode({
    uid:  'V_001',
    type: 'valve',
    data: { lat: -19.158, lon: 146.851, pressure: 320, status: 'open' },
});

// 4. Re-project on every map viewport change
map.on('move', () => {
    geo.reproject();
    index.build(store.getNodes());
});

// 5. Hit-test on click
map.on('click', (e) => {
    const hits = index.queryPoint(e.point.x, e.point.y, 20);
    if (hits.length) console.log('Clicked:', hits[0].uid);
});
```

---

## GeoProjection

Pluggable coordinate adapter. Wraps any map library's projection behind a uniform interface.

```js
const projection = new GeoProjection({ project, unproject });
```

| Parameter | Type | Description |
|---|---|---|
| `project` | `(lat, lon) => { x, y }` | Geographic to canvas pixel coordinates |
| `unproject` | `(x, y) => { lat, lon }` | Canvas pixel to geographic coordinates |

### Methods

| Method | Returns | Description |
|---|---|---|
| `project(lat, lon)` | `{ x, y }` | Forward projection |
| `unproject(x, y)` | `{ lat, lon }` | Inverse projection |

### Map library examples

**Mapbox GL JS:**

```js
new GeoProjection({
    project:   (lat, lon) => map.project([lon, lat]),
    unproject: (x, y)     => {
        const ll = map.unproject([x, y]);
        return { lat: ll.lat, lon: ll.lng };
    },
});
```

**Leaflet:**

```js
new GeoProjection({
    project:   (lat, lon) => map.latLngToContainerPoint([lat, lon]),
    unproject: (x, y)     => {
        const ll = map.containerPointToLatLng([x, y]);
        return { lat: ll.lat, lon: ll.lng };
    },
});
```

---

## GeoGraphState

Connects a `GraphStore` to a `GeoProjection`. Extends `EventBus`.

```js
const geo = new GeoGraphState(store, projection);
```

### Methods

| Method | Returns | Description |
|---|---|---|
| `reproject()` | — | Re-derive all node x/y from `data.lat`/`data.lon`. Also re-projects edge waypoints with lat/lon. Emits `'geo:reprojected'`. |
| `setProjection(projection)` | — | Replace the projection adapter |
| `project(lat, lon)` | `{ x, y }` | Convenience forward projection |
| `unproject(x, y)` | `{ lat, lon }` | Convenience inverse projection |

### Node data convention

Nodes must carry geographic coordinates in their `data` field:

```js
store.addNode({
    uid:  'tower-42',
    type: 'cell-tower',
    data: { lat: 51.5074, lon: -0.1278, bandwidth: 100 },
});
```

Nodes without `data.lat` / `data.lon` are skipped during reprojection.

### Edge waypoints

Edges with `data.waypoints` containing lat/lon are also re-projected:

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

Grid-based spatial index for efficient point and rect queries at scale. Replaces brute-force iteration for graphs with thousands of geo-positioned nodes.

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

### Usage with reproject

```js
map.on('move', () => {
    geo.reproject();
    index.build(store.getNodes());
});

// Click hit-test
const hits = index.queryPoint(mouseX, mouseY, 20);

// Box select
const selected = index.queryRect(selX, selY, selX + selW, selY + selH);
```
