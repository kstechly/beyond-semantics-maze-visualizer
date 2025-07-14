// Random Walk solver
export const random = {
  name: 'Random Walk',
  /**
   * Solve maze by random walk until goal is reached
   * @param {number} token
  * @param {object} ctx  {rows, cols, grid, startX, startY, goalX, goalY,
  *   drawVisitCell(x, y, count, maxVisits), drawPointer(x,y), drawMarker,
  *   stepsPerFrame, abortCheck, requestAnimationFrame}
   */
  solve(token, ctx) {
    const { rows, cols, grid,
            startX, startY, goalX, goalY,
            drawVisitCell, drawPointer, drawMarker,
            stepsPerFrame, abortCheck, requestAnimationFrame } = ctx;
    // Track visit counts per cell
    const visits = Array(rows).fill(null).map(() => Array(cols).fill(0));
    let maxVisits = 0;
    // Warm-up runs: perform 30 full random walks to prime visit counts (no rendering)
    // Warm-up runs: perform 30 full random walks to prime visit counts (no rendering)
    for (let w = 0; w < 30; w++) {
      if (!abortCheck(token)) return;
      let tx = startX, ty = startY;
      visits[ty][tx]++;
      maxVisits = Math.max(maxVisits, visits[ty][tx]);
      // Walk until reaching the goal
      while (tx !== goalX || ty !== goalY) {
        if (!abortCheck(token)) return;
        // choose a random valid neighbor
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
        let nx, ny;
        do {
          const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
          nx = tx + dx;
          ny = ty + dy;
        } while (nx < 0 || nx >= cols || ny < 0 || ny >= rows || grid[ny][nx] === 0);
        tx = nx;
        ty = ny;
        visits[ty][tx]++;
        maxVisits = Math.max(maxVisits, visits[ty][tx]);
      }
    }
    // Initial draw of primed heatmap (no pointer)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const count = visits[y][x];
        if (count > 0) drawVisitCell(x, y, count, maxVisits);
      }
    }
    // Reset position for animated run and initialize pointer state
    let cx = startX, cy = startY;
    let pointerX = cx, pointerY = cy;
    let lastPointerTime = performance.now();

    function step() {
      if (!abortCheck(token)) return;
      // Single random move
      if (cx !== goalX || cy !== goalY) {
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
        let nx, ny;
        do {
          const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
          nx = cx + dx;
          ny = cy + dy;
        } while (nx < 0 || nx >= cols || ny < 0 || ny >= rows || grid[ny][nx] === 0);
        cx = nx;
        cy = ny;
        // Update visits
        visits[cy][cx]++;
        if (visits[cy][cx] > maxVisits) maxVisits = visits[cy][cx];
      }
      // Redraw heatmap of all visited cells
      // Redraw heatmap of all visited cells (skip unvisited: leave white)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const count = visits[y][x];
          if (count > 0) {
            drawVisitCell(x, y, count, maxVisits);
          }
        }
      }
      // Update pointer position once per 100ms, moving one cell toward walker each interval
      const now = performance.now();
      if (now - lastPointerTime >= 100) {
        const dx = cx - pointerX;
        const dy = cy - pointerY;
        if (dx !== 0) {
          pointerX += Math.sign(dx);
        } else if (dy !== 0) {
          pointerY += Math.sign(dy);
        }
        lastPointerTime = now;
      }
      // Always redraw start/goal markers first
      drawMarker(startX, startY, 'gray', 'S');
      drawMarker(goalX, goalY, 'green', 'G');
      // Draw pointer on top of markers
      drawPointer(pointerX, pointerY);
      // Schedule next move after 100ms if goal not yet reached
      if (cx !== goalX || cy !== goalY) {
        setTimeout(step, 100);
      }
    }
    // Start animated run with one move per 100ms
    setTimeout(step, 100);
  }
};