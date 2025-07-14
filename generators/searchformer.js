/**
 * SearchFormer Style maze generator
 *
 * This algorithm samples wall cells at random (30–50% density), then picks a random
 * start/goal and runs an internal A* check (no drawing) to ensure solvability and
 * a minimum path length. If the layout fails, it clears and retries.  
 * Note: we include a small A* here; if we ever need A* elsewhere, we should
 * factor this out into a shared utility and avoid duplication.
 */
export const searchformer = {
  name: 'SearchFormer Style',
  /**
   * @param {number} token  generation token for cancellation
   * @param {object} ctx    { rows, cols, grid, drawCell, stepsPerFrame, finishMaze, clearGrid, abortCheck, requestAnimationFrame }
   */
  generate(token, ctx) {
    const { rows, cols, grid, drawCell, stepsPerFrame, finishMaze, clearGrid, abortCheck, requestAnimationFrame } = ctx;
    // speed up carving: multiply throttle by factor (DFS uses default stepsPerFrame)
    const carveSteps = stepsPerFrame * 2;
    const total = rows * cols;
    const base = Math.floor(total / 10);
    const minWalls = base * 3;
    const maxWalls = base * 5;
    // index list [0..total-1]
    const indices = Array.from({ length: total }, (_, i) => i);
    let numWalls = 0;
    // How many start/goal placement attempts per maze before resampling walls
    let placementAttempts = 0;
    // Store validated solver start/goal coordinates for finishMaze
    let sx, sy, gx, gy;
    // Pre-sliced list of passage cell indices and carve pointer
    let passages = [];
    let pPtr = 0;

    // Fisher-Yates shuffle
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    // Synchronous A* search: returns path array or null
    function runAstarSync(startX, startY, goalX, goalY) {
      const openSet = [[startX, startY]];
      const closed = Array(rows).fill(null).map(() => Array(cols).fill(false));
      const gScore = Array(rows).fill(null).map(() => Array(cols).fill(Infinity));
      const fScore = Array(rows).fill(null).map(() => Array(cols).fill(Infinity));
      const cameFrom = Array(rows).fill(null).map(() => Array(cols).fill(null));
      gScore[startY][startX] = 0;
      fScore[startY][startX] = Math.abs(startX - goalX) + Math.abs(startY - goalY);
      while (openSet.length) {
        // pick lowest fScore
        let best = 0;
        for (let i = 1; i < openSet.length; i++) {
          const [x, y] = openSet[i];
          if (fScore[y][x] < fScore[openSet[best][1]][openSet[best][0]]) best = i;
        }
        const [cx, cy] = openSet.splice(best, 1)[0];
        if (cx === goalX && cy === goalY) {
          // reconstruct path
          const path = [[cx, cy]];
          let x = cx, y = cy;
          while (cameFrom[y][x]) {
            [x, y] = cameFrom[y][x];
            path.push([x, y]);
          }
          return path.reverse();
        }
        closed[cy][cx] = true;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (grid[ny][nx] === 0 || closed[ny][nx]) continue;
          const tentative = gScore[cy][cx] + 1;
          if (tentative < gScore[ny][nx]) {
            cameFrom[ny][nx] = [cx, cy];
            gScore[ny][nx] = tentative;
            fScore[ny][nx] = tentative + Math.abs(nx - goalX) + Math.abs(ny - goalY);
            if (!openSet.some(p => p[0] === nx && p[1] === ny)) openSet.push([nx, ny]);
          }
        }
      }
      return null;
    }

    // initialize sampling parameters
    function resetSampling() {
      shuffle(indices);
      numWalls = minWalls + Math.floor(Math.random() * (maxWalls - minWalls + 1));
      // Build passages list (walls are first numWalls entries)
      passages = indices.slice(numWalls);
      pPtr = 0;
      placementAttempts = 0;
    }
    resetSampling();

    // iterative step: carve passages then validate
    function step() {
      if (!abortCheck(token)) return;
      // carve passages (walls set by clearGrid)
      for (let i = 0; i < carveSteps && pPtr < passages.length; i++, pPtr++) {
        const idx = passages[pPtr];
        const x = idx % cols;
        const y = Math.floor(idx / cols);
        grid[y][x] = 1;
        drawCell(x, y);
      }
      if (pPtr < passages.length) {
        requestAnimationFrame(step);
        return;
      }
      // validation via A* with up to 100 start/goal placements
      const free = passages.slice();
      let success = false;
      let path;
   for (; placementAttempts < 100; placementAttempts++) {
        shuffle(free);
        const sIdx = free[0], gIdx = free[1];
        sx = sIdx % cols;
        sy = Math.floor(sIdx / cols);
        gx = gIdx % cols;
        gy = Math.floor(gIdx / cols);
        path = runAstarSync(sx, sy, gx, gy);
        if (path && path.length >= Math.max(rows, cols)) {
          success = true;
          break;
        }
      }
      if (!success) {
        // too many placement failures: restart full maze sampling
        clearGrid();
        resetSampling();
        requestAnimationFrame(step);
        return;
      }
      // success: hand off to finishMaze with the validated start/goal
      finishMaze(token, sx, sy, gx, gy);
    }
    requestAnimationFrame(step);
  },
  /**
   * Headless synchronous SearchFormer-style generator.
   * @param {object} params { rows, cols, prng }
   * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
   */
  generateSync({ rows, cols, prng }) {
    // parameters for sampling
    const total = rows * cols;
    const base = Math.floor(total / 10);
    const minWalls = base * 3;
    const maxWalls = base * 5;
    // helper: shuffle array
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    // synchronous A* search
    function runAstarSync(grid, startX, startY, goalX, goalY) {
      const openSet = [[startX, startY]];
      const closed = Array(rows).fill(null).map(() => Array(cols).fill(false));
      const gScore = Array(rows).fill(null).map(() => Array(cols).fill(Infinity));
      const fScore = Array(rows).fill(null).map(() => Array(cols).fill(Infinity));
      const cameFrom = Array(rows).fill(null).map(() => Array(cols).fill(null));
      gScore[startY][startX] = 0;
      fScore[startY][startX] = Math.abs(startX - goalX) + Math.abs(startY - goalY);
      while (openSet.length) {
        // pick lowest fScore
        let best = 0;
        for (let i = 1; i < openSet.length; i++) {
          const [x, y] = openSet[i];
          if (fScore[y][x] < fScore[openSet[best][1]][openSet[best][0]]) best = i;
        }
        const [cx, cy] = openSet.splice(best, 1)[0];
        if (cx === goalX && cy === goalY) {
          // reconstruct path
          const path = [[cx, cy]];
          let x = cx, y = cy;
          while (cameFrom[y][x]) {
            [x, y] = cameFrom[y][x];
            path.push([x, y]);
          }
          return path.reverse();
        }
        closed[cy][cx] = true;
        for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (grid[ny][nx] === 0 || closed[ny][nx]) continue;
          const tentative = gScore[cy][cx] + 1;
          if (tentative < gScore[ny][nx]) {
            cameFrom[ny][nx] = [cx, cy];
            gScore[ny][nx] = tentative;
            fScore[ny][nx] = tentative + Math.abs(nx - goalX) + Math.abs(ny - goalY);
            if (!openSet.some(p => p[0]===nx && p[1]===ny)) openSet.push([nx, ny]);
          }
        }
      }
      return null;
    }
    // main sampling loop
    let grid;
    let startX, startY, goalX, goalY;
    const indices = Array.from({ length: total }, (_, i) => i);
    while (true) {
      // shuffle and choose walls
      shuffle(indices);
      const numWalls = minWalls + Math.floor(prng() * (maxWalls - minWalls + 1));
      const passages = indices.slice(numWalls);
      // initialize grid with walls
      grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
      // carve passages
      for (const idx of passages) {
        const x = idx % cols;
        const y = Math.floor(idx / cols);
        grid[y][x] = 1;
      }
      // attempt start/goal placement
      const free = passages.slice();
      shuffle(free);
      let path = null;
      for (let attempt = 0; attempt < 100; attempt++) {
        const sIdx = free[0], gIdx = free[1];
        startX = sIdx % cols; startY = Math.floor(sIdx / cols);
        goalX  = gIdx % cols; goalY  = Math.floor(gIdx / cols);
        path = runAstarSync(grid, startX, startY, goalX, goalY);
        if (path && path.length >= Math.max(rows, cols)) break;
        shuffle(free);
      }
      if (path) {
        break;
      }
      // else retry whole sampling
    }
    return { grid, startX, startY, goalX, goalY };
  }
};