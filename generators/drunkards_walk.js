// Drunkard's Walk maze generator
export const drunkards_walk = {
  name: "Drunkard's Walk",
  /**
   * Carve passages by a random walk until a target percentage is reached.
   * @param {number} token      generation token for cancellation
   * @param {object} ctx        { rows, cols, grid, drawCell, stepsPerFrame,
   *                             finishMaze, abortCheck, requestAnimationFrame,
   *                             coverage }
   */
  generate(token, ctx) {
    const {
      rows, cols,
      grid,
      drawCell,
      finishMaze,
      abortCheck,
      requestAnimationFrame,
      clearCanvas,
      coverage
    } = ctx;
    // Determine number of cells to carve (at least 2 for start/goal)
    const total = rows * cols;
    const target = Math.max(2, Math.min(total,
      Math.floor(total * (typeof coverage === 'number' ? coverage : 0))
    ));
    // Perform the random walk synchronously, recording carve operations
    const ops = [];
    let x = Math.floor(Math.random() * cols);
    let y = Math.floor(Math.random() * rows);
    grid[y][x] = 1;
    ops.push([x, y]);
    let carved = 1;
    while (carved < target) {
      // Random valid neighbor
      const dirs = [];
      if (x > 0) dirs.push([-1, 0]);
      if (x < cols - 1) dirs.push([1, 0]);
      if (y > 0) dirs.push([0, -1]);
      if (y < rows - 1) dirs.push([0, 1]);
      const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
      x += dx;
      y += dy;
      if (grid[y][x] === 0) {
        grid[y][x] = 1;
        ops.push([x, y]);
        carved++;
      }
    }
    // Animate the buffered operations in a fixed number of frames (30)
    const totalOps = ops.length;
    const frames = 30;
    let frame = 0;
    function render() {
      if (!abortCheck(token)) return;
      // Clear only the canvas (retain grid state)
      clearCanvas();
      // Draw operations up to this frame
      const upto = Math.floor((frame + 1) * totalOps / frames);
      for (let i = 0; i < upto; i++) {
        const [cx, cy] = ops[i];
        drawCell(cx, cy);
      }
      frame++;
      if (frame < frames) {
        requestAnimationFrame(render);
      } else {
        finishMaze(token);
      }
    }
    requestAnimationFrame(render);
  },
  /**
   * Headless synchronous Drunkard's Walk generator.
   * @param {object} params { rows, cols, prng }
   * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
   */
  generateSync({ rows, cols, prng, coverage = 0.5 }) {
    // Prepare grid of walls (0)
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    const total = rows * cols;
    // Use provided coverage or default to 50%
    const target = Math.max(2, Math.min(total, Math.floor(total * coverage)));
    // start at a random position
    let x = Math.floor(prng() * cols);
    let y = Math.floor(prng() * rows);
    grid[y][x] = 1;
    let carved = 1;
    // random walk until target carved cells
    while (carved < target) {
      // pick a random valid neighbor
      const dirs = [];
      if (x > 0) dirs.push([-1, 0]);
      if (x < cols - 1) dirs.push([1, 0]);
      if (y > 0) dirs.push([0, -1]);
      if (y < rows - 1) dirs.push([0, 1]);
      const [dx, dy] = dirs[Math.floor(prng() * dirs.length)];
      x += dx; y += dy;
      if (grid[y][x] === 0) {
        grid[y][x] = 1;
        carved++;
      }
    }
    // collect floor cells
    const floors = [];
    for (let yy = 0; yy < rows; yy++) {
      for (let xx = 0; xx < cols; xx++) {
        if (grid[yy][xx] === 1) floors.push([xx, yy]);
      }
    }
    // pick random distinct start and goal
    const idxA = Math.floor(prng() * floors.length);
    let idxB;
    // Ensure we have at least 2 floor cells to avoid infinite loop
    if (floors.length < 2) {
      throw new Error(`Drunkard's Walk: Not enough floor cells (${floors.length}) to place start and goal`);
    }
    do { idxB = Math.floor(prng() * floors.length); } while (idxB === idxA);
    const [startX, startY] = floors[idxA];
    const [goalX, goalY]   = floors[idxB];
    return { grid, startX, startY, goalX, goalY };
  }
};