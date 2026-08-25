/**
 * SpatialIndex — grid-based spatial index for efficient geographic queries.
 *
 * Designed for graphs with thousands of geo-positioned nodes (infrastructure
 * networks, telecom towers, sensor grids). Replaces brute-force iteration
 * with O(1) cell lookup for point and rect queries.
 *
 * Uses a flat grid rather than an R-tree — simpler, no dependencies, and
 * sufficient for the fixed-zoom-range use case of map overlays. Cell size
 * is configurable; 100px is a reasonable default for most map zoom levels.
 *
 * Rebuild the index after reproject() to keep it in sync with node positions.
 *
 * @example
 *
 *   const index = new SpatialIndex({ cellSize: 100 });
 *   index.build(store.getNodes());
 *
 *   // After map moves:
 *   geo.reproject();
 *   index.build(store.getNodes());
 *
 *   // Point query (click hit-test):
 *   const hits = index.queryPoint(mouseX, mouseY, 20);  // 20px radius
 *
 *   // Rect query (box select):
 *   const selected = index.queryRect(x1, y1, x2, y2);
 */

export class SpatialIndex {
    #cellSize;
    #grid;      // Map<cellKey, node[]>
    #nodes;     // all indexed nodes

    /**
     * @param {{ cellSize?: number }} [opts]
     */
    constructor({ cellSize = 100 } = {}) {
        this.#cellSize = cellSize;
        this.#grid     = new Map();
        this.#nodes    = [];
    }

    /**
     * (Re)build the index from the current node positions.
     * Call after every reproject().
     *
     * @param {object[]} nodes  Array of nodes with { uid, x, y, w?, h? }
     */
    build(nodes) {
        this.#grid.clear();
        this.#nodes = nodes;

        for (const node of nodes) {
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const key = this.#cellKey(x, y);
            if (!this.#grid.has(key)) this.#grid.set(key, []);
            this.#grid.get(key).push(node);
        }
    }

    /**
     * Find nodes near a point within a pixel radius.
     * Uses center-to-point distance.
     *
     * @param {number} px         X coordinate (canvas px)
     * @param {number} py         Y coordinate (canvas px)
     * @param {number} [radius=20]  Search radius in px
     * @returns {object[]} Matching nodes, sorted by distance (nearest first)
     */
    queryPoint(px, py, radius = 20) {
        const r2 = radius * radius;
        const results = [];
        const cellRadius = Math.ceil(radius / this.#cellSize);

        const cx = Math.floor(px / this.#cellSize);
        const cy = Math.floor(py / this.#cellSize);

        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                const key = `${cx + dx}:${cy + dy}`;
                const cell = this.#grid.get(key);
                if (!cell) continue;

                for (const node of cell) {
                    const nx = (node.x ?? 0) + (node.w ?? 0) / 2;
                    const ny = (node.y ?? 0) + (node.h ?? 0) / 2;
                    const d2 = (nx - px) ** 2 + (ny - py) ** 2;
                    if (d2 <= r2) results.push({ node, distance: Math.sqrt(d2) });
                }
            }
        }

        results.sort((a, b) => a.distance - b.distance);
        return results.map(r => r.node);
    }

    /**
     * Find all nodes whose bounding box intersects a rectangle.
     *
     * @param {number} x1  Left edge (canvas px)
     * @param {number} y1  Top edge (canvas px)
     * @param {number} x2  Right edge (canvas px)
     * @param {number} y2  Bottom edge (canvas px)
     * @returns {object[]} Matching nodes
     */
    queryRect(x1, y1, x2, y2) {
        // Normalise so x1 < x2, y1 < y2
        if (x1 > x2) [x1, x2] = [x2, x1];
        if (y1 > y2) [y1, y2] = [y2, y1];

        const cx1 = Math.floor(x1 / this.#cellSize);
        const cy1 = Math.floor(y1 / this.#cellSize);
        const cx2 = Math.floor(x2 / this.#cellSize);
        const cy2 = Math.floor(y2 / this.#cellSize);

        const seen = new Set();
        const results = [];

        for (let cx = cx1; cx <= cx2; cx++) {
            for (let cy = cy1; cy <= cy2; cy++) {
                const cell = this.#grid.get(`${cx}:${cy}`);
                if (!cell) continue;

                for (const node of cell) {
                    if (seen.has(node.uid)) continue;
                    seen.add(node.uid);

                    const nx = node.x ?? 0;
                    const ny = node.y ?? 0;
                    const nw = node.w ?? 0;
                    const nh = node.h ?? 0;

                    // AABB intersection
                    if (nx + nw >= x1 && nx <= x2 && ny + nh >= y1 && ny <= y2) {
                        results.push(node);
                    }
                }
            }
        }

        return results;
    }

    /** Number of indexed nodes. */
    get size() { return this.#nodes.length; }

    /** Number of occupied grid cells. */
    get cellCount() { return this.#grid.size; }

    // ── Internal ──────────────────────────────────────────────────────────────

    #cellKey(x, y) {
        return `${Math.floor(x / this.#cellSize)}:${Math.floor(y / this.#cellSize)}`;
    }
}
