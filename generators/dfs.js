// Randomized DFS maze generator (recursive backtracker)
export const dfs = {
  name: 'Depth-first Search',
  /**
   * Generate maze using randomized DFS
   * @param {number} token  generation token for cancellation
   * @param {object} ctx    { rows, cols, grid, stack, drawCell, stepsPerFrame, finishMaze, abortCheck, requestAnimationFrame }
   */
  generate(token, ctx) {
    const { rows, cols, grid, stack, drawCell, stepsPerFrame, finishMaze, abortCheck, requestAnimationFrame } = ctx;
    function step() {
      if (!abortCheck(token)) return;
      for (let i = 0; i < stepsPerFrame; i++) {
        if (stack.length === 0) {
          finishMaze(token);
          return;
        }
        const [x, y] = stack[stack.length - 1];
        const neighbors = [];
        if (y > 1 && grid[y - 2][x] === 0) neighbors.push([x, y - 2]);
        if (x < cols - 2 && grid[y][x + 2] === 0) neighbors.push([x + 2, y]);
        if (y < rows - 2 && grid[y + 2][x] === 0) neighbors.push([x, y + 2]);
        if (x > 1 && grid[y][x - 2] === 0) neighbors.push([x - 2, y]);
        if (neighbors.length > 0) {
          const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
          const wallX = (x + nx) >> 1;
          const wallY = (y + ny) >> 1;
          grid[wallY][wallX] = 1;
          drawCell(wallX, wallY);
          grid[ny][nx] = 1;
          drawCell(nx, ny);
          stack.push([nx, ny]);
        } else {
          stack.pop();
        }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  },
  /**
   * Headless synchronous DFS maze generator.
   * @param {object} ctx { rows, cols, prng }
   * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
   */
  generateSync({ rows, cols, prng }) {
    // Initialize all walls (0)
    const grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    // Start at a random cell (odd coordinates), or (0,0) if even grid
    let startX = 0, startY = 0;
    grid[startY][startX] = 1;
    const stack = [[startX, startY]];
    while (stack.length > 0) {
      const [x, y] = stack[stack.length - 1];
      const neighbors = [];
      if (y > 1 && grid[y - 2][x] === 0) neighbors.push([x, y - 2]);
      if (x < cols - 2 && grid[y][x + 2] === 0) neighbors.push([x + 2, y]);
      if (y < rows - 2 && grid[y + 2][x] === 0) neighbors.push([x, y + 2]);
      if (x > 1 && grid[y][x - 2] === 0) neighbors.push([x - 2, y]);
      if (neighbors.length > 0) {
        const idx = Math.floor(prng() * neighbors.length);
        const [nx, ny] = neighbors[idx];
        // carve wall between
        const wx = (x + nx) >> 1;
        const wy = (y + ny) >> 1;
        grid[wy][wx] = 1;
        grid[ny][nx] = 1;
        stack.push([nx, ny]);
      } else {
        stack.pop();
      }
    }
    // Choose random start inside passages
    const pickRandom = () => {
      let rx, ry;
      do {
        rx = Math.floor(prng() * cols);
        ry = Math.floor(prng() * rows);
      } while (grid[ry][rx] === 0);
      return [rx, ry];
    };
    [startX, startY] = pickRandom();
    let goalX, goalY;
    do {
      [goalX, goalY] = pickRandom();
    } while (goalX === startX && goalY === startY);
    return { grid, startX, startY, goalX, goalY };
  }
};