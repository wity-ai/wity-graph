/**
 * GeoGraphState — projects a GraphStore's nodes to geographic coordinates.
 *
 * Reads lat/lon from each node's `data.lat` and `data.lon` fields,
 * projects them to canvas pixel positions via a GeoProjection adapter,
 * and writes the result back to the node's x/y fields.
 *
 * Call `reproject()` on every map viewport change (pan, zoom, resize)
 * to keep node positions in sync with the map. Edge paths that depend
 * on node positions (including polyline waypoints) are also re-projected.
 *
 * This replaces PanZoomState + layout engine for geo-backed graphs.
 * The map library owns the viewport transform — GeoGraphState just
 * derives pixel positions from it.
 *
 * @example
 *
 *   import { GraphStore } from '@wity/graph-headless';
 *   import { GeoProjection, GeoGraphState } from '@wity/graph-geo';
 *
 *   const store = new GraphStore();
 *   const projection = new GeoProjection({
 *       project:   (lat, lon) => map.project([lon, lat]),
 *       unproject: (x, y)     => { const ll = map.unproject([x, y]); return { lat: ll.lat, lon: ll.lng }; },
 *   });
 *   const geo = new GeoGraphState(store, projection);
 *
 *   store.addNode({ uid: 'V_001', type: 'valve', data: { lat: -19.158, lon: 146.851 } });
 *
 *   map.on('move', () => geo.reproject());   // re-derive all x/y from lat/lon
 */

import { EventBus } from '@wity/graph-headless';

export class GeoGraphState extends EventBus {
    #store;
    #projection;

    /**
     * @param {import('@wity/graph-headless').GraphStore} store
     * @param {import('./geo-projection.js').GeoProjection} projection
     */
    constructor(store, projection) {
        super();
        this.#store      = store;
        this.#projection = projection;
    }

    /** Replace the projection adapter (e.g. when switching map libraries). */
    setProjection(projection) {
        this.#projection = projection;
    }

    /**
     * Re-project all nodes and edge waypoints from lat/lon to canvas x/y.
     * Call this on every map viewport change.
     *
     * Emits 'geo:reprojected' with { count } after all nodes are updated.
     */
    reproject() {
        const nodes = this.#store.getNodes();
        let count = 0;

        for (const node of nodes) {
            const lat = node.data?.lat;
            const lon = node.data?.lon;
            if (lat == null || lon == null) continue;

            const { x, y } = this.#projection.project(lat, lon);
            this.#store.updateNode(node.uid, { x, y, _computedInitialProps: true });
            count++;
        }

        // Re-project edge waypoints if they carry lat/lon
        const edges = this.#store.getEdges();
        for (const edge of edges) {
            const waypoints = edge.data?.waypoints;
            if (!waypoints?.length) continue;

            const hasGeo = waypoints[0]?.lat != null;
            if (!hasGeo) continue;

            const projected = waypoints.map(wp => {
                const { x, y } = this.#projection.project(wp.lat, wp.lon);
                return { lat: wp.lat, lon: wp.lon, x, y, 0: x, 1: y };
            });
            this.#store.updateEdge?.(edge.uid, { data: { ...edge.data, waypoints: projected } });
        }

        this.emit('geo:reprojected', { count });
    }

    /**
     * Project a single lat/lon to canvas coordinates.
     * Convenience wrapper around the projection adapter.
     *
     * @param {number} lat
     * @param {number} lon
     * @returns {{ x: number, y: number }}
     */
    project(lat, lon) {
        return this.#projection.project(lat, lon);
    }

    /**
     * Convert canvas coordinates back to lat/lon.
     *
     * @param {number} x
     * @param {number} y
     * @returns {{ lat: number, lon: number }}
     */
    unproject(x, y) {
        return this.#projection.unproject(x, y);
    }
}
