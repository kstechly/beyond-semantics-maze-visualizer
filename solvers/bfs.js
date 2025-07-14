// Breadth-first Search solver
export const bfs = {
  name: 'Breadth-first Search',
  /**
   * Solve maze using Breadth-First Search
   * @param {number} token
   * @param {object} ctx  {rows, cols, grid, startX, startY, goalX, goalY, drawCell, drawClosedCell, drawPathCell, drawMarker, stepsPerFrame, reconstructPath, abortCheck, requestAnimationFrame}
   */
  solve(token, ctx) {
    const { rows, cols, grid, startX, startY, goalX, goalY,
            drawCell, drawClosedCell, drawPathCell, drawMarker,
            stepsPerFrame, reconstructPath,
            abortCheck, requestAnimationFrame } = ctx;
    const solver = {
      openSet: [[startX, startY]],
      closedSet: Array(rows).fill(null).map(() => Array(cols).fill(false)),
      cameFrom: Array(rows).fill(null).map(() => Array(cols).fill(null)),
      oldPath: []
    };
    function step() {
      if (!abortCheck(token)) return;
      let found = false;
      let currentX, currentY;
      for (let i = 0; i < stepsPerFrame; i++) {
        if (solver.openSet.length === 0) break;
        [currentX, currentY] = solver.openSet.shift();
        if (currentX === goalX && currentY === goalY) { found = true; break; }
        solver.closedSet[currentY][currentX] = true;
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
        for (const [dx, dy] of dirs) {
          const nx = currentX + dx, ny = currentY + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (grid[ny][nx] === 0 || solver.closedSet[ny][nx]) continue;
          if (!solver.openSet.some(n => n[0]===nx && n[1]===ny)) {
            solver.cameFrom[ny][nx] = [currentX, currentY];
            solver.openSet.push([nx, ny]);
          }
        }
      }
      if (currentX !== undefined) {
        const newPath = reconstructPath(solver.cameFrom, currentX, currentY);
        for (const [px, py] of solver.oldPath) drawCell(px, py);
        for (let yy = 0; yy < rows; yy++) for (let xx = 0; xx < cols; xx++)
          if (solver.closedSet[yy][xx]) drawClosedCell(xx, yy);
        for (const [px, py] of newPath) drawPathCell(px, py);
        drawMarker(startX, startY, 'gray', 'S'); drawMarker(goalX, goalY, 'green', 'G');
        solver.oldPath = newPath;
      }
      if (!found) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
};