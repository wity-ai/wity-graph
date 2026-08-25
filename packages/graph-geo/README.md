# @wity/graph-geo

Geospatial projection layer for [wity-graph](https://www.wity.ai/stack/knowledge-graph/). Maps geographic coordinates (lat/lon) to canvas pixel positions via pluggable projection adapters.

Works with any map library — Mapbox GL, Leaflet, OpenLayers, CesiumJS.

## Install

```bash
npm install @wity/graph-geo
```

## Usage

```js
import { GraphStore } from '@wity/graph-headless';
import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';

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

// Add geo-positioned nodes
store.addNode({ uid: 'V_001', type: 'valve', data: { lat: -19.158, lon: 146.851 } });

// Re-project on every map viewport change
map.on('move', () => {
    geo.reproject();
    index.build(store.getNodes());
});

// Hit-test on click
map.on('click', (e) => {
    const hits = index.queryPoint(e.point.x, e.point.y, 20);
});
```

## API

### GeoProjection

Pluggable coordinate adapter. Wraps any map library's projection behind `project(lat, lon) → {x, y}` and `unproject(x, y) → {lat, lon}`.

### GeoGraphState

Connects a GraphStore to a GeoProjection. Call `reproject()` on map viewport changes to re-derive all node x/y from their `data.lat`/`data.lon`. Also re-projects edge waypoints that carry lat/lon.

### SpatialIndex

Grid-based spatial index for efficient point and rect queries at scale. Call `build(nodes)` after each `reproject()`. Provides `queryPoint(x, y, radius)` and `queryRect(x1, y1, x2, y2)`.
