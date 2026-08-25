/**
 * @wity/graph-geo
 *
 * Spatial projection layer for wity graph.
 *
 * Projects nodes from any spatial coordinate system to canvas pixel positions
 * via pluggable projection adapters. Works with any system that can produce
 * a 2D pixel projection:
 *
 *   - Geographic maps (Mapbox GL, Leaflet, OpenLayers, CesiumJS)
 *   - Floor plans, factory layouts (metric → pixel)
 *   - PCB schematics, circuit layouts
 *   - Orbital/celestial views
 *   - Game maps, virtual worlds
 *   - Any (a, b) → (x, y) coordinate transform
 *
 * Complements graph-headless (topology + abstract canvas) and graph-player
 * (temporal). Does not replace PanZoomState — the external spatial system
 * owns the viewport transform in geo mode.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  Spatial system (map / CAD / game engine / viewer)      │
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
 *       unproject: (x, y)     => { const ll = map.unproject([x, y]); return { a: ll.lat, b: ll.lng }; },
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
