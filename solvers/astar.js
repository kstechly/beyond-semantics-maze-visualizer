// A* (Manhattan) solver

// Shared direction vectors
const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];

// Find and remove the node with lowest fScore from openSet
function extractLowestFScore(openSet, fScore) {
  let lowestIndex = 0;
  let lowestF = fScore[openSet[0][1]][openSet[0][0]];
  for (let i = 1; i < openSet.length; i++) {
    const [x, y] = openSet[i];
    if (fScore[y][x] < lowestF) {
      lowestF = fScore[y][x];
      lowestIndex = i;
    }
  }
  return openSet.splice(lowestIndex, 1)[0];
}

// Reconstruct path from cameFrom map
function reconstructPathInternal(cameFrom, startX, startY, goalX, goalY) {
  const path = [];
  let x = goalX, y = goalY;
  while (x !== startX || y !== startY) {
    path.push([x, y]);
    const prev = cameFrom[y][x];
    if (!prev) break;
    [x, y] = prev;
  }
  path.push([startX, startY]);
  return path.reverse();
}

export const astar = {
  name: 'A* (Manhattan)',
  /**
   * Solve maze using A* search with Manhattan heuristic
   * @param {number} token
   * @param {object} ctx  {rows, cols, grid, startX, startY, goalX, goalY, drawCell, drawClosedCell, drawPathCell, drawMarker, stepsPerFrame, heuristic, reconstructPath, abortCheck, requestAnimationFrame}
   */
  solve(token, ctx) {
    const { rows, cols, grid, startX, startY, goalX, goalY,
            drawCell, drawClosedCell, drawPathCell, drawMarker,
            stepsPerFrame, heuristic, reconstructPath,
            abortCheck, requestAnimationFrame } = ctx;
    const solver = {
      openSet: [[startX, startY]],
      closedSet: Array(rows).fill(null).map(() => Array(cols).fill(false)),
      gScore: Array(rows).fill(null).map(() => Array(cols).fill(Infinity)),
      fScore: Array(rows).fill(null).map(() => Array(cols).fill(Infinity)),
      cameFrom: Array(rows).fill(null).map(() => Array(cols).fill(null)),
      oldPath: []
    };
    solver.gScore[startY][startX] = 0;
    solver.fScore[startY][startX] = heuristic(startX, startY, goalX, goalY);
    function step() {
      if (!abortCheck(token)) return;
      let found = false;
      let currentX, currentY;
      for (let i = 0; i < stepsPerFrame; i++) {
        if (solver.openSet.length === 0) break;
        // pick lowest fScore
        [currentX, currentY] = extractLowestFScore(solver.openSet, solver.fScore);
        if (currentX === goalX && currentY === goalY) { found = true; break; }
        solver.closedSet[currentY][currentX] = true;
        for (const [dx, dy] of DIRS) {
          const nx = currentX + dx, ny = currentY + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          if (grid[ny][nx] === 0 || solver.closedSet[ny][nx]) continue;
          const tentativeG = solver.gScore[currentY][currentX] + 1;
          if (tentativeG < solver.gScore[ny][nx]) {
            solver.cameFrom[ny][nx] = [currentX, currentY];
            solver.gScore[ny][nx] = tentativeG;
            solver.fScore[ny][nx] = tentativeG + heuristic(nx, ny, goalX, goalY);
            if (!solver.openSet.some(n => n[0]===nx && n[1]===ny)) solver.openSet.push([nx, ny]);
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
  },
  /**
   * Headless synchronous A* solver for dataset generation.
   * @param {object} ctx { rows, cols, grid, startX, startY, goalX, goalY, heuristic }
   * @returns {{ reasoning: Array, plan: Array }}
   */
  solveSync(ctx) {
    const { rows, cols, grid, startX, startY, goalX, goalY, heuristic } = ctx;
    const gScore = Array(rows).fill(null).map(() => Array(cols).fill(Infinity));
    const fScore = Array(rows).fill(null).map(() => Array(cols).fill(Infinity));
    const cameFrom = Array(rows).fill(null).map(() => Array(cols).fill(null));
    const closedSet = Array(rows).fill(null).map(() => Array(cols).fill(false));
    const openSet = [[startX, startY]];
    gScore[startY][startX] = 0;
    fScore[startY][startX] = heuristic(startX, startY, goalX, goalY);
    const reasoning = [];
    while (openSet.length > 0) {
      // pick node with lowest fScore
      const [currentX, currentY] = extractLowestFScore(openSet, fScore);
      // record close event: g-cost and h-cost (heuristic)
      reasoning.push([
        'close', currentX, currentY,
        'c' + gScore[currentY][currentX],
        'c' + heuristic(currentX, currentY, goalX, goalY)
      ]);
      if (currentX === goalX && currentY === goalY) break;
      closedSet[currentY][currentX] = true;
      for (const [dx, dy] of DIRS) {
        const nx = currentX + dx, ny = currentY + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (grid[ny][nx] === 0 || closedSet[ny][nx]) continue;
        const tentativeG = gScore[currentY][currentX] + 1;
        if (tentativeG < gScore[ny][nx]) {
          cameFrom[ny][nx] = [currentX, currentY];
          gScore[ny][nx] = tentativeG;
          fScore[ny][nx] = tentativeG + heuristic(nx, ny, goalX, goalY);
          // record create event for neighbor: g-cost and h-cost (heuristic)
          reasoning.push([
            'create', nx, ny,
            'c' + tentativeG,
            'c' + heuristic(nx, ny, goalX, goalY)
          ]);
          if (!openSet.some(([x,y]) => x===nx && y===ny)) {
            openSet.push([nx, ny]);
          }
        }
      }
    }
    // Reconstruct path
    const plan = reconstructPathInternal(cameFrom, startX, startY, goalX, goalY);
    return { reasoning, plan };
  }
};
