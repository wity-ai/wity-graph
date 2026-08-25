/**
 * GeoProjection — pluggable coordinate adapter between a spatial coordinate
 * system and canvas pixel space.
 *
 * Wraps any spatial system's projection behind a uniform interface so
 * graph-geo stays coordinate-system-agnostic. Works with:
 *   - Geographic maps (Mapbox, Leaflet, OpenLayers, CesiumJS)
 *   - Orbital/celestial maps (CesiumJS, Three.js globe)
 *   - Floor plans, factory layouts, PCB schematics
 *   - Game maps, virtual worlds
 *   - Any coordinate system that can be projected to 2D canvas pixels
 *
 * The consumer provides two functions:
 *   project(a, b)     → { x, y }     spatial coords → canvas pixels
 *   unproject(x, y)   → { a, b }     canvas pixels → spatial coords
 *
 * The meaning of (a, b) depends on the coordinate system:
 *   Geographic:  (lat, lon)
 *   Floor plan:  (metersX, metersY)
 *   Orbital:     (azimuth, elevation)
 *   Game map:    (tileX, tileY)
 *
 * These are called on every viewport change to re-derive node positions.
 *
 * @example — Mapbox GL JS (geographic)
 *
 *   const projection = new GeoProjection({
 *       project:   (lat, lon) => map.project([lon, lat]),
 *       unproject: (x, y)     => {
 *           const ll = map.unproject([x, y]);
 *           return { a: ll.lat, b: ll.lng };
 *       },
 *   });
 *
 * @example — Floor plan (metric coordinates → pixel)
 *
 *   const SCALE = 50;  // 50px per meter
 *   const projection = new GeoProjection({
 *       project:   (mX, mY) => ({ x: mX * SCALE, y: mY * SCALE }),
 *       unproject: (x, y)   => ({ a: x / SCALE, b: y / SCALE }),
 *   });
 */

export class GeoProjection {
    #projectFn;
    #unprojectFn;

    /**
     * @param {{ project: (a: number, b: number) => { x: number, y: number },
     *           unproject: (x: number, y: number) => { a: number, b: number } }} fns
     */
    constructor({ project, unproject }) {
        if (typeof project !== 'function' || typeof unproject !== 'function') {
            throw new Error('[GeoProjection] project and unproject must be functions');
        }
        this.#projectFn   = project;
        this.#unprojectFn = unproject;
    }

    /**
     * Spatial coordinates → canvas pixel coordinates.
     * @param {number} a  First spatial coordinate (e.g. lat, metersX, azimuth)
     * @param {number} b  Second spatial coordinate (e.g. lon, metersY, elevation)
     * @returns {{ x: number, y: number }}
     */
    project(a, b) {
        return this.#projectFn(a, b);
    }

    /**
     * Canvas pixel → spatial coordinates.
     * @param {number} x
     * @param {number} y
     * @returns {{ a: number, b: number }}
     */
    unproject(x, y) {
        return this.#unprojectFn(x, y);
    }
}
