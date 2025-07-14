/**
 * Randomized Kruskal's algorithm for maze generation with random parity offset
 *
 * This generator picks a random even/odd 'offset' (0 or 1) and treats cells where
 * (x % 2 === offset && y % 2 === offset) as rooms. It builds all potential edges
 * between adjacent rooms (two-step neighbors), shuffles them, and in an animation
 * loop unions the sets and carves the connecting wall when they are in different
 * sets. Once all edges are processed, it calls finishMaze(token) to place start/goal.
 *
 * Note: This embeds a small Union-Find implementation; if you later need UF elsewhere
 * consider refactoring it into a shared utility.
 */
export const kruskal = {
  name: "Kruskal's (Randomized)",
  /**
   * @param {number} token
   * @param {object} ctx  { rows, cols, grid, drawCell, stepsPerFrame, finishMaze, clearGrid, abortCheck, requestAnimationFrame }
   */
  generate(token, ctx) {
    const { rows, cols, grid, drawCell, stepsPerFrame, finishMaze, clearGrid, abortCheck, requestAnimationFrame } = ctx;
    // Clear any pre-seeded cell (e.g. from generateNewMaze)
    clearGrid();
    // Pick random parity offset (0 or 1)
    const offset = Math.random() < 0.5 ? 0 : 1;
    // Build room cells list and map to UF indices
    const rooms = [];
    const roomId = Object.create(null);
    for (let y = offset; y < rows; y += 2) {
      for (let x = offset; x < cols; x += 2) {
        const idx = y * cols + x;
        roomId[idx] = rooms.length;
        rooms.push(idx);
        grid[y][x] = 1;
        drawCell(x, y);
      }
    }
    const numRooms = rooms.length;
    // Build edge list between two-step neighbors
    const edges = [];
    for (const idx of rooms) {
      const x = idx % cols, y = Math.floor(idx / cols);
      const id1 = roomId[idx];
      // only right and down to avoid duplicates
      [[2, 0], [0, 2]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx < cols && ny < rows) {
          const nIdx = ny * cols + nx;
          const id2 = roomId[nIdx];
          if (id2 !== undefined) {
            // wall is midpoint
            const wx = x + dx/2 | 0;
            const wy = y + dy/2 | 0;
            edges.push([id1, id2, wx, wy]);
          }
        }
      });
    }
    // Union-Find setup
    const parent = new Array(numRooms);
    for (let i = 0; i < numRooms; i++) parent[i] = i;
    function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
    function union(a, b) { parent[find(a)] = find(b); }
    // Shuffle edges
    (function(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    })(edges);
    // Carve edges in an animated loop
    let ptr = 0;
    function step() {
      if (!abortCheck(token)) return;
      for (let i = 0; i < stepsPerFrame && ptr < edges.length; i++, ptr++) {
        const [u, v, wx, wy] = edges[ptr];
        if (find(u) !== find(v)) {
          union(u, v);
          grid[wy][wx] = 1;
          drawCell(wx, wy);
        }
      }
      if (ptr < edges.length) {
        requestAnimationFrame(step);
      } else {
        finishMaze(token);
      }
    }
    requestAnimationFrame(step);
  },
  /**
   * Headless synchronous Kruskal maze generator.
   * @param {object} params { rows, cols, prng }
   * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
   */
  generateSync({ rows, cols, prng }) {
    // Initialize all walls
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    // Random parity offset (0 or 1)
    const offset = prng() < 0.5 ? 0 : 1;
    // Build list of room coordinates and mapping to UF indices
    const rooms = [];
    const roomId = {};
    for (let y = offset; y < rows; y += 2) {
      for (let x = offset; x < cols; x += 2) {
        const idx = rooms.length;
        rooms.push([x, y]);
        roomId[`${x},${y}`] = idx;
        grid[y][x] = 1;
      }
    }
    const n = rooms.length;
    // Build edges between two-step neighbors (right and down)
    const edges = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = rooms[i];
      // right neighbor
      if (x + 2 < cols) {
        const key = `${x+2},${y}`;
        if (key in roomId) {
          edges.push([i, roomId[key], x+1, y]);
        }
      }
      // down neighbor
      if (y + 2 < rows) {
        const key = `${x},${y+2}`;
        if (key in roomId) {
          edges.push([i, roomId[key], x, y+1]);
        }
      }
    }
    // Union-Find structures
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
    function union(a, b) { parent[find(a)] = find(b); }
    // Shuffle edges using prng
    for (let i = edges.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      [edges[i], edges[j]] = [edges[j], edges[i]];
    }
    // Carve passages
    for (const [u, v, wx, wy] of edges) {
      if (find(u) !== find(v)) {
        union(u, v);
        grid[wy][wx] = 1;
      }
    }
    // Helper to pick random floor cell
    const pick = () => {
      let x, y;
      do {
        x = Math.floor(prng() * cols);
        y = Math.floor(prng() * rows);
      } while (grid[y][x] === 0);
      return [x, y];
    };
    const [startX, startY] = pick();
    let [goalX, goalY] = pick();
    // Ensure goal != start
    if (startX === goalX && startY === goalY) {
      [goalX, goalY] = pick();
    }
    return { grid, startX, startY, goalX, goalY };
  }
};