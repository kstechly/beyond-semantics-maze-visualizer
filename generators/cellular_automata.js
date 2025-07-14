// Cellular Automata maze generator
// Implements a cave generation using standard CA rules with p0=0.45, S=4, B=5
export const cellular_automata = {
  name: 'Cellular Automata',
  /**
   * @param {number} token
   * @param {object} ctx { rows, cols, grid, drawCell, finishMaze,
   *                       clearCanvas, abortCheck, requestAnimationFrame,
   *                       iterations }
   */
  generate(token, ctx) {
    const {
      rows, cols, grid,
      drawCell, drawWallCell, finishMaze,
      clearCanvas, abortCheck, requestAnimationFrame,
      iterations,
      fillProbability,
      survivalThreshold,
      birthThreshold
    } = ctx;
    // Initial random fill: alive=wall with p0 (default 0.45), dead=floor
    const p0 = typeof fillProbability === 'number' ? fillProbability : 0.45;
    // Operations buffer: record all cell state changes
    const ops = [];
    // Initial random fill: alive=wall(0) with p0, dead=floor(1)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const val = (Math.random() < p0) ? 0 : 1;
        grid[y][x] = val;
        // record op
        ops.push({ type: val === 1 ? 'cell' : 'wall', x, y });
      }
    }
    // Shuffle initial fill ops to randomize reveal order
    const initialCount = ops.length;
    for (let i = initialCount - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ops[i], ops[j]] = [ops[j], ops[i]];
    }
    // Helper to count alive neighbors; out-of-bounds counts as alive
    function countAlive(y, x) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue;
          const ny = y + dy, nx = x + dx;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || grid[ny][nx] === 0) {
            // off-grid or wall counts as alive
            count++;
          }
        }
      }
      return count;
    }
    // Run CA iterations synchronously with S (survival) and B (birth) thresholds
    const surviveThresh = typeof survivalThreshold === 'number' ? survivalThreshold : 4;
    const birthThresh   = typeof birthThreshold   === 'number' ? birthThreshold   : 5;
    // buffer for next state
    let newGrid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let it = 0; it < (iterations || 0); it++) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const aliveN = countAlive(y, x);
          let val;
          if (grid[y][x] === 0) {
            val = aliveN < surviveThresh ? 1 : 0;
          } else {
            val = aliveN > birthThresh ? 0 : 1;
          }
          newGrid[y][x] = val;
        }
      }
      // commit new state and record diffs
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const oldVal = grid[y][x];
          const newVal = newGrid[y][x];
          if (oldVal !== newVal) {
            ops.push({ type: newVal === 1 ? 'cell' : 'wall', x, y });
            grid[y][x] = newVal;
          }
        }
      }
    }
    // Collect final floor cells for start/goal selection
    const floorCells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) floorCells.push([x, y]);
      }
    }
    // Determine a connected start/goal pair within the main component
    let startX = 0, startY = 0, goalX = 0, goalY = 0;
    if (floorCells.length > 0) {
      // pick random start cell
      const [sx, sy] = floorCells[Math.floor(Math.random() * floorCells.length)];
      startX = sx; startY = sy;
      // BFS flood-fill to find reachable floor cells (4-way)
      const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));
      const queue = [[sx, sy]];
      visited[sy][sx] = true;
      const reachable = [[sx, sy]];
      while (queue.length) {
        const [cx, cy] = queue.shift();
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx] && grid[ny][nx] === 1) {
            visited[ny][nx] = true;
            reachable.push([nx, ny]);
            queue.push([nx, ny]);
          }
        }
      }
      // pick random goal from reachable (ensure at least one)
      if (reachable.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * reachable.length); }
        while (reachable[idx][0] === startX && reachable[idx][1] === startY);
        [goalX, goalY] = reachable[idx];
      } else {
        goalX = startX;
        goalY = startY;
      }
    }
    const total = ops.length;
    const frames = 30;
    let frame = 0;
    function render() {
      if (!abortCheck(token)) return;
      clearCanvas();
      const upto = Math.floor((frame + 1) * total / frames);
      for (let i = 0; i < upto; i++) {
        const op = ops[i];
        if (op.type === 'cell') {
          drawCell(op.x, op.y);
        } else if (op.type === 'wall') {
          drawWallCell(op.x, op.y);
        }
      }
      frame++;
      if (frame < frames) {
        requestAnimationFrame(render);
      } else {
        // invoke finish with fixed start/goal to ensure connectivity
        finishMaze(token, startX, startY, goalX, goalY);
      }
    }
    requestAnimationFrame(render);
  },
  /**
   * Headless synchronous Cellular Automata generator.
   * @param {object} params { rows, cols, prng }
   * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
   */
  generateSync({ rows, cols, prng, fillProbability = 0.45, survivalThreshold = 4, birthThreshold = 5, iterations = 3 }) {
    // Use provided parameters or defaults
    // Initialize grid with random fill: 0=wall, 1=floor
    let grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        grid[y][x] = prng() < fillProbability ? 0 : 1;
      }
    }
    // Helper to count alive neighbors (wall counts as alive)
    function countAlive(y, x) {
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy, nx = x + dx;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || grid[ny][nx] === 0) {
            cnt++;
          }
        }
      }
      return cnt;
    }
    // Run CA iterations
    for (let it = 0; it < iterations; it++) {
      const newGrid = Array(rows).fill(null).map(() => Array(cols).fill(0));
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const alive = countAlive(y, x);
          if (grid[y][x] === 0) {
            newGrid[y][x] = alive < survivalThreshold ? 1 : 0;
          } else {
            newGrid[y][x] = alive > birthThreshold ? 0 : 1;
          }
        }
      }
      grid = newGrid;
    }
    // Collect floor cells
    const floors = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) floors.push([x, y]);
      }
    }
    // Pick random distinct start/goal
    const pickIdx = () => Math.floor(prng() * floors.length);
    const a = pickIdx();
    let b;
    do { b = pickIdx(); } while (b === a);
    const [startX, startY] = floors[a];
    const [goalX, goalY]   = floors[b];
    return { grid, startX, startY, goalX, goalY };
  }
};