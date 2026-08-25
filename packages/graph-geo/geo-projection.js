/**
 * GeoProjection — pluggable coordinate adapter between geographic and canvas space.
 *
 * Wraps any map library's projection (Mapbox, Leaflet, OpenLayers, CesiumJS)
 * behind a uniform interface so graph-geo stays map-library-agnostic.
 *
 * The consumer provides two functions:
 *   project(lat, lon)   → { x, y }   geographic → screen/canvas pixels
 *   unproject(x, y)     → { lat, lon }   screen/canvas pixels → geographic
 *
 * These are called on every viewport change (map pan/zoom) to re-derive
 * node positions. The graph's topology and data stay untouched — only the
 * x/y pixel coordinates change.
 *
 * @example — Mapbox GL JS
 *
 *   const map = new mapboxgl.Map({ ... });
 *   const projection = new GeoProjection({
 *       project:   (lat, lon) => map.project([lon, lat]),   // returns mapboxgl.Point
 *       unproject: (x, y)     => {
 *           const ll = map.unproject([x, y]);
 *           return { lat: ll.lat, lon: ll.lng };
 *       },
 *   });
 *
 * @example — Leaflet
 *
 *   const map = L.map('map');
 *   const projection = new GeoProjection({
 *       project:   (lat, lon) => map.latLngToContainerPoint([lat, lon]),
 *       unproject: (x, y)     => {
 *           const ll = map.containerPointToLatLng([x, y]);
 *           return { lat: ll.lat, lon: ll.lng };
 *       },
 *   });
 */

export class GeoProjection {
    #projectFn;
    #unprojectFn;

    /**
     * @param {{ project: (lat: number, lon: number) => { x: number, y: number },
     *           unproject: (x: number, y: number) => { lat: number, lon: number } }} fns
     */
    constructor({ project, unproject }) {
        if (typeof project !== 'function' || typeof unproject !== 'function') {
            throw new Error('[GeoProjection] project and unproject must be functions');
        }
        this.#projectFn   = project;
        this.#unprojectFn = unproject;
    }

    /**
     * Geographic → canvas pixel coordinates.
     * @param {number} lat
     * @param {number} lon
     * @returns {{ x: number, y: number }}
     */
    project(lat, lon) {
        return this.#projectFn(lat, lon);
    }

    /**
     * Canvas pixel → geographic coordinates.
     * @param {number} x
     * @param {number} y
     * @returns {{ lat: number, lon: number }}
     */
    unproject(x, y) {
        return this.#unprojectFn(x, y);
    }
}
