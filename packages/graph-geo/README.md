# @wity/graph-geo

Spatial projection layer for [wity-graph](https://www.wity.ai/stack/knowledge-graph/). Projects nodes from any spatial coordinate system to canvas pixel positions via pluggable projection adapters.

Works with geographic maps (Mapbox GL, Leaflet, OpenLayers), floor plans, PCB layouts, orbital views, game maps — any system that can produce a 2D pixel projection.

## Install

```bash
npm install @wity/graph-geo
```

## Usage

### Geographic (Mapbox GL)

```js
import { GraphStore } from '@wity/graph-headless';
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';

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

store.addNode({ uid: 'V_001', type: 'valve', data: { lat: -19.158, lon: 146.851 } });

map.on('move', () => {
    geo.reproject();
    index.build(store.getNodes());
});
```

### Floor plan (metric → pixel)

```js
const SCALE = 50;  // 50px per meter
const projection = new GeoProjection({
    project:   (mX, mY) => ({ x: mX * SCALE, y: mY * SCALE }),
    unproject: (x, y)   => ({ a: x / SCALE, b: y / SCALE }),
});

const geo = new GeoGraphState(store, projection, { coordFields: ['mX', 'mY'] });
store.addNode({ uid: 'machine-1', type: 'cnc', data: { mX: 12.5, mY: 8.3 } });
```

### Game map (tile coordinates)

```js
const geo = new GeoGraphState(store, projection, { coordFields: ['tileX', 'tileY'] });
store.addNode({ uid: 'tower-1', type: 'guard-tower', data: { tileX: 42, tileY: 17 } });
```

## API

### GeoProjection

Pluggable coordinate adapter. Wraps any spatial system's projection behind `project(a, b) → {x, y}` and `unproject(x, y) → {a, b}`. The meaning of (a, b) depends on your coordinate system — (lat, lon), (metersX, metersY), (tileX, tileY), etc.

### GeoGraphState

Connects a GraphStore to a GeoProjection. Call `reproject()` on viewport changes to re-derive all node x/y from their spatial coordinates. Also re-projects edge waypoints.

Constructor option `coordFields` (default `['lat', 'lon']`) sets which `node.data` fields are read as the two spatial coordinates.

### SpatialIndex

Grid-based spatial index for efficient point and rect queries at scale. Call `build(nodes)` after each `reproject()`. Provides `queryPoint(x, y, radius)` and `queryRect(x1, y1, x2, y2)`.
