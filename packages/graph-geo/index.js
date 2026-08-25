/**
 * @wity/graph-geo
 *
 * Geospatial projection layer for wity graph.
 *
 * Maps geographic coordinates (lat/lon) to canvas pixel positions via
 * pluggable projection adapters. Works with any map library — Mapbox GL,
 * Leaflet, OpenLayers, CesiumJS — by injecting project/unproject functions.
 *
 * Complements graph-headless (topology + abstract canvas) and graph-player
 * (temporal). Does not replace PanZoomState — the map library owns the
 * viewport transform in geo mode.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Map Library (Mapbox / Leaflet / OpenLayers / Cesium)   │
 * ├─────────────────────────────────────────────────────────┤
 * │  graph-geo                                              │
 * │  GeoProjection · GeoGraphState · SpatialIndex           │
 * ├─────────────────────────────────────────────────────────┤
 * │  graph-headless                                         │
 * │  GraphStore / GraphAbstract · Ontology · Traversal      │
 * └─────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   import { GeoProjection, GeoGraphState, SpatialIndex } from '@wity/graph-geo';
 *
 *   const projection = new GeoProjection({
 *       project:   (lat, lon) => map.project([lon, lat]),
 *       unproject: (x, y)     => { const ll = map.unproject([x, y]); return { lat: ll.lat, lon: ll.lng }; },
 *   });
 *
 *   const geo   = new GeoGraphState(store, projection);
 *   const index = new SpatialIndex({ cellSize: 100 });
 *
 *   map.on('move', () => {
 *       geo.reproject();
 *       index.build(store.getNodes());
 *   });
 */

export { GeoProjection }  from './geo-projection.js';
export { GeoGraphState }  from './geo-graph-state.js';
export { SpatialIndex }   from './spatial-index.js';
