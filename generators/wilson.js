/**
 * Wilson's algorithm for perfect maze generation (loop-erased random walk)
 * Performs the complete loop-erased random walk synchronously, records all draw operations,
 * then animates those operations in exactly 30 frames.
 *
 * @param token generation token for cancellation
 * @param ctx { rows, cols, grid, drawCell, drawWalkCell, drawWallCell, clearGrid, clearCanvas, finishMaze, abortCheck, requestAnimationFrame }
 */
export const wilson = {
  name: "Wilson's (Loop-Erased)",
  /**
   * Generate maze with Wilson's algorithm, record operations and replay in 30 frames.
   */
  generate(token, ctx) {
    const {
      rows, cols, grid,
      drawCell: realDrawCell,
      drawWalkCell: realDrawWalkCell,
      drawWallCell: realDrawWallCell,
      clearGrid, clearCanvas,
      finishMaze, abortCheck, requestAnimationFrame
    } = ctx;
    // Buffer for draw operations
    const ops = [];
    const record = (type, x, y) => ops.push({ type, x, y });
    const drawCell = (x, y) => record('cell', x, y);
    const drawWalkCell = (x, y) => record('walk', x, y);
    const drawWallCell = (x, y) => record('erase', x, y);
    // Initialize: clear grid and canvas
    clearGrid();
    // Build room list
    const rooms = [];
    const offset = Math.random() < 0.5 ? 0 : 1;
    for (let y = offset; y < rows; y += 2) {
      for (let x = offset; x < cols; x += 2) {
        rooms.push([x, y]);
      }
    }
    const numRooms = rooms.length;
    // Seed first room
    const [sx0, sy0] = rooms[Math.floor(Math.random() * numRooms)];
    grid[sy0][sx0] = 1;
    drawCell(sx0, sy0);
    const inMaze = new Set([`${sx0},${sy0}`]);
    let inCount = 1;
    // (unvisited list not needed; we use rooms + inMaze to pick new starts)
    // const unvisited = rooms.filter(([x, y]) => grid[y][x] === 0);
    const dirs = [[2,0],[0,2],[-2,0],[0,-2]];
    let path = [];
    let indexMap = Object.create(null);
    // Synchronous Wilson loop: walk until connecting, then carve entire path
    while (inCount < numRooms) {
      // Pick a new random start cell (among parity rooms not yet in the maze)
      let root;
      do { root = rooms[Math.floor(Math.random() * rooms.length)]; }
      while (inMaze.has(`${root[0]},${root[1]}`));
      // Perform a loop-erased random walk until we hit the existing maze
      path = [root];
      indexMap = { [`${root[0]},${root[1]}`]: 0 };
      drawWalkCell(root[0], root[1]);
      while (true) {
        if (!abortCheck(token)) return;
        const [cx, cy] = path[path.length - 1];
        const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const key = `${nx},${ny}`;
        if (inMaze.has(key)) {
          path.push([nx, ny]);
          break;
        }
        if (key in indexMap) {
          // Erase any loop segment
          const idx = indexMap[key];
          for (let i = idx + 1; i < path.length; i++) {
            const [ex, ey] = path[i];
            drawWallCell(ex, ey);
            const [px, py] = path[i - 1];
            const wx = (px + ex) >> 1, wy = (py + ey) >> 1;
            drawWallCell(wx, wy);
            delete indexMap[`${ex},${ey}`];
          }
          path.length = idx + 1;
        } else {
          // Extend walk
          indexMap[key] = path.length;
          path.push([nx, ny]);
          const [px, py] = path[path.length - 2];
          const wx = (px + nx) >> 1, wy = (py + ny) >> 1;
          drawWalkCell(wx, wy);
          drawWalkCell(nx, ny);
        }
      }
      // Carve the entire path into the maze (all cells and intervening walls)
      for (let i = 0; i < path.length; i++) {
        const [cx, cy] = path[i];
        const key = `${cx},${cy}`;
        if (!inMaze.has(key)) {
          inMaze.add(key);
          inCount++;
          grid[cy][cx] = 1;
          drawCell(cx, cy);
        }
        if (i > 0) {
          const [px, py] = path[i - 1];
          const wx = (px + cx) >> 1, wy = (py + cy) >> 1;
          grid[wy][wx] = 1;
          drawCell(wx, wy);
        }
      }
      path = [];
      indexMap = Object.create(null);
    }
    // Playback in 30 frames
    const total = ops.length, frames = 30;
    let frame = 0;
    function render() {
      if (!abortCheck(token)) return;
      clearCanvas();
      const upto = Math.floor((frame + 1) * total / frames);
      for (let i = 0; i < upto; i++) {
        const op = ops[i];
        if (op.type === 'cell') realDrawCell(op.x, op.y);
        else if (op.type === 'walk') realDrawWalkCell(op.x, op.y);
        else if (op.type === 'erase') realDrawWallCell(op.x, op.y);
      }
      frame++;
      if (frame < frames) requestAnimationFrame(render);
      else finishMaze(token);
    }
    requestAnimationFrame(render);
  },
  /**
   * Headless synchronous Wilson's algorithm generator.
   * @param {object} params { rows, cols, prng }
   * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
   */
  generateSync({ rows, cols, prng }) {
    // Headless synchronous Wilson's algorithm (loop-erased random walk)
    // Initialize all walls
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    // Parity offset for rooms
    const offset = prng() < 0.5 ? 0 : 1;
    // Build list of room coordinates
    const rooms = [];
    for (let y = offset; y < rows; y += 2) {
      for (let x = offset; x < cols; x += 2) {
        rooms.push([x, y]);
      }
    }
    // Seed maze with one random room
    const inMaze = new Set();
    const first = rooms[Math.floor(prng() * rooms.length)];
    const [sx0, sy0] = first;
    grid[sy0][sx0] = 1;
    inMaze.add(`${sx0},${sy0}`);
    // Directions for two-step jumps
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
    // Loop-erased random walks to carve all rooms
    while (inMaze.size < rooms.length) {
      // pick a random start outside the maze
      let root;
      do {
        root = rooms[Math.floor(prng() * rooms.length)];
      } while (inMaze.has(`${root[0]},${root[1]}`));
      // perform loop-erased walk
      const path = [root.slice()];
      let indexMap = { [`${root[0]},${root[1]}`]: 0 };
      while (true) {
        const [cx, cy] = path[path.length - 1];
        const [dx, dy] = dirs[Math.floor(prng() * dirs.length)];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const key = `${nx},${ny}`;
        if (inMaze.has(key)) {
          path.push([nx, ny]);
          break;
        }
        if (key in indexMap) {
          // erase loop: remove any entries after the first occurrence
          const idx = indexMap[key];
          path.splice(idx + 1);
          // rebuild indexMap for the trimmed path
          indexMap = {};
          for (let j = 0; j < path.length; j++) {
            const k2 = `${path[j][0]},${path[j][1]}`;
            indexMap[k2] = j;
          }
        } else {
          // extend path
          indexMap[key] = path.length;
          path.push([nx, ny]);
        }
      }
      // carve the path into the maze
      for (let i = 0; i < path.length; i++) {
        const [cx, cy] = path[i];
        const ck = `${cx},${cy}`;
        if (!inMaze.has(ck)) {
          inMaze.add(ck);
          grid[cy][cx] = 1;
        }
        if (i > 0) {
          const [px, py] = path[i - 1];
          const wx = (px + cx) >> 1;
          const wy = (py + cy) >> 1;
          grid[wy][wx] = 1;
        }
      }
    }
    // pick random distinct start and goal
    const floors = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) floors.push([x, y]);
      }
    }
    const pick = () => floors[Math.floor(prng() * floors.length)];
    const [startX, startY] = pick();
    let [goalX, goalY] = pick();
    if (startX === goalX && startY === goalY) {
      [goalX, goalY] = pick();
    }
    return { grid, startX, startY, goalX, goalY };
  }
};