/**
 * GeoGraphState — projects a GraphStore's nodes from spatial coordinates
 * to canvas pixel positions.
 *
 * Reads two coordinate fields from each node's `data` object, projects
 * them to canvas x/y via a GeoProjection adapter, and writes the result
 * back to the node's x/y fields.
 *
 * The coordinate field names are configurable — defaults to `data.lat`
 * and `data.lon` for geographic use, but can be set to any field names
 * for non-geographic spatial systems (floor plans, game maps, orbital
 * views, PCB layouts, etc.).
 *
 * Call `reproject()` on every viewport change (map pan/zoom, canvas resize)
 * to keep node positions in sync with the spatial system.
 *
 * This replaces PanZoomState + layout engine for spatially-backed graphs.
 * The external system (map library, CAD viewer, etc.) owns the viewport
 * transform — GeoGraphState just derives pixel positions from it.
 *
 * @example — Geographic (Mapbox)
 *
 *   const geo = new GeoGraphState(store, projection);
 *   // reads data.lat and data.lon by default
 *   store.addNode({ uid: 'V_001', type: 'valve', data: { lat: -19.158, lon: 146.851 } });
 *
 * @example — Floor plan (metric coordinates)
 *
 *   const geo = new GeoGraphState(store, projection, { coordFields: ['mX', 'mY'] });
 *   store.addNode({ uid: 'machine-1', type: 'cnc', data: { mX: 12.5, mY: 8.3 } });
 *
 * @example — Game map (tile coordinates)
 *
 *   const geo = new GeoGraphState(store, projection, { coordFields: ['tileX', 'tileY'] });
 *   store.addNode({ uid: 'tower-1', type: 'guard-tower', data: { tileX: 42, tileY: 17 } });
 */

import { EventBus } from '@wity/graph-headless';

export class GeoGraphState extends EventBus {
    #store;
    #projection;
    #fieldA;
    #fieldB;

    /**
     * @param {import('@wity/graph-headless').GraphStore} store
     * @param {import('./geo-projection.js').GeoProjection} projection
     * @param {object} [options]
     * @param {[string, string]} [options.coordFields=['lat', 'lon']]
     *        Names of the two coordinate fields on node.data.
     *        First field → first arg of project(a, b).
     *        Second field → second arg of project(a, b).
     */
    constructor(store, projection, { coordFields = ['lat', 'lon'] } = {}) {
        super();
        this.#store      = store;
        this.#projection = projection;
        this.#fieldA     = coordFields[0];
        this.#fieldB     = coordFields[1];
    }

    /** Replace the projection adapter. */
    setProjection(projection) {
        this.#projection = projection;
    }

    /**
     * Re-project all nodes and edge waypoints to canvas x/y.
     * Call this on every viewport change.
     *
     * Emits 'geo:reprojected' with { count } after all nodes are updated.
     */
    reproject() {
        const nodes = this.#store.getNodes();
        let count = 0;

        for (const node of nodes) {
            const a = node.data?.[this.#fieldA];
            const b = node.data?.[this.#fieldB];
            if (a == null || b == null) continue;

            const { x, y } = this.#projection.project(a, b);
            this.#store.updateNode(node.uid, { x, y, _computedInitialProps: true });
            count++;
        }

        // Re-project edge waypoints if they carry the same coordinate fields
        const edges = this.#store.getEdges();
        for (const edge of edges) {
            const waypoints = edge.data?.waypoints;
            if (!waypoints?.length) continue;

            const hasCoords = waypoints[0]?.[this.#fieldA] != null;
            if (!hasCoords) continue;

            const projected = waypoints.map(wp => {
                const { x, y } = this.#projection.project(wp[this.#fieldA], wp[this.#fieldB]);
                return { ...wp, x, y, 0: x, 1: y };
            });
            this.#store.updateEdge?.(edge.uid, { data: { ...edge.data, waypoints: projected } });
        }

        this.emit('geo:reprojected', { count });
    }

    /**
     * Project a single spatial coordinate pair to canvas coordinates.
     *
     * @param {number} a  First spatial coordinate
     * @param {number} b  Second spatial coordinate
     * @returns {{ x: number, y: number }}
     */
    project(a, b) {
        return this.#projection.project(a, b);
    }

    /**
     * Convert canvas coordinates back to spatial coordinates.
     *
     * @param {number} x
     * @param {number} y
     * @returns {{ a: number, b: number }}
     */
    unproject(x, y) {
        return this.#projection.unproject(x, y);
    }
}
