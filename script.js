// Core maze/solver imports
import { generators } from './generators.js';
import { solvers } from './solvers.js';

// State management class
class MazeState {
  constructor() {
    this.grid = null;
    this.rows = 0;
    this.cols = 0;
    this.startPos = null;
    this.goalPos = null;
    this.currentToken = 0;
  }
  
  setGrid(grid, rows, cols) {
    this.grid = grid;
    this.rows = rows;
    this.cols = cols;
  }
  
  setPositions(start, goal) {
    this.startPos = start;
    this.goalPos = goal;
  }
  
  getDirectionalPositions(direction) {
    if (direction === 'forward') {
      return { start: this.startPos, goal: this.goalPos };
    }
    return { start: this.goalPos, goal: this.startPos };
  }
}

// Position selection utilities
class PositionSelector {
  static selectRandomPassage(grid, rows, cols, exclude = null) {
    let x, y;
    do {
      x = Math.floor(Math.random() * cols);
      y = Math.floor(Math.random() * rows);
    } while (grid[y][x] === 0 || (exclude && x === exclude.x && y === exclude.y));
    return { x, y };
  }
  
  static selectStartAndGoal(grid, rows, cols, providedStart, providedGoal) {
    // Handle provided positions
    const start = providedStart && typeof providedStart.x === 'number' && typeof providedStart.y === 'number'
      ? providedStart
      : this.selectRandomPassage(grid, rows, cols);
    
    const goal = providedGoal && typeof providedGoal.x === 'number' && typeof providedGoal.y === 'number'
      ? providedGoal
      : this.selectRandomPassage(grid, rows, cols, start);
    
    return { start, goal };
  }
}

// Canvas operations class
class MazeCanvas {
  constructor(ctx, cellSize, offsetX, offsetY) {
    this.ctx = ctx;
    this.cellSize = cellSize;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }
  
  drawCell(x, y) {
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(
      this.offsetX + x * this.cellSize,
      this.offsetY + y * this.cellSize,
      this.cellSize,
      this.cellSize
    );
  }
  
  drawMarker(x, y, color, letter) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      this.offsetX + x * this.cellSize,
      this.offsetY + y * this.cellSize,
      this.cellSize,
      this.cellSize
    );
    if (letter) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = `${Math.floor(this.cellSize * 0.8)}px monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        letter,
        this.offsetX + x * this.cellSize + this.cellSize / 2,
        this.offsetY + y * this.cellSize + this.cellSize / 2
      );
    }
  }
  
  clearSolution(grid, rows, cols) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) {
          this.drawCell(x, y);
        }
      }
    }
  }
  
  drawMarkers(start, goal) {
    this.drawMarker(start.x, start.y, 'gray', 'S');
    this.drawMarker(goal.x, goal.y, 'green', 'G');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Canvas setup
  const canvas = document.getElementById('mazeCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const width = canvas.width;
  const height = canvas.height;

  // Grid configuration
  const cols = 30;
  const rows = 30;

  // Compute cell size and offsets for centering
  const cellSize = Math.floor(Math.min(width / cols, height / rows));
  const gridW = cellSize * cols;
  const gridH = cellSize * rows;
  const offsetX = Math.floor((width - gridW) / 2);
  const offsetY = Math.floor((height - gridH) / 2);

  ctx.imageSmoothingEnabled = false;

  // Initialize state management and canvas helper
  const mazeState = new MazeState();
  const mazeCanvas = new MazeCanvas(ctx, cellSize, offsetX, offsetY);
  
  let grid, stack;
  // carveStart is the initial seed for maze generation;
  let carveStartX, carveStartY;
  let generationToken = 0;
  const stepsPerFrame = 10;


  // UI controls
  const mazeAlgoSelect = document.getElementById('mazeAlgoSelect');
  const solveAlgoSelect = document.getElementById('solveAlgoSelect');
  const solveDirSelect   = document.getElementById('solveDirSelect');
  // Populate maze-generator dropdown
  for (const key in generators) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = generators[key].name;
    mazeAlgoSelect.appendChild(opt);
  }
  for (const key in solvers) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = solvers[key].name;
    solveAlgoSelect.appendChild(opt);
  }
  // Restore last selections from localStorage or fall back to first option
  const savedMaze = localStorage.getItem('mazeAlgo');
  if (savedMaze && savedMaze !== 'load' && generators[savedMaze]) {
    mazeAlgoSelect.value = savedMaze;
  } else {
    mazeAlgoSelect.value = Object.keys(generators)[0];
    localStorage.setItem('mazeAlgo', mazeAlgoSelect.value);
  }
  const savedSolve = localStorage.getItem('solveAlgo');
  if (savedSolve && solvers[savedSolve]) {
    solveAlgoSelect.value = savedSolve;
  } else {
    solveAlgoSelect.value = Object.keys(solvers)[0];
  }
  const savedDir = localStorage.getItem('solveDir');
  if (savedDir === 'forward' || savedDir === 'backward') {
    solveDirSelect.value = savedDir;
  } else {
    solveDirSelect.value = 'forward';
  }
  // Drunkard's Walk and Cellular Automata slider controls (guarded)
  const dwContainer = document.getElementById('dwSliderContainer');
  const dwInput     = document.getElementById('dwSliderInput');
  const dwValue     = document.getElementById('dwSliderValue');
  const caContainer = document.getElementById('caControlsContainer');
  const caIterationsInput = document.getElementById('caIterationsInput');
  const caIterationsValue = document.getElementById('caIterationsValue');
  const caFillInput       = document.getElementById('caFillInput');
  const caFillValue       = document.getElementById('caFillValue');
  const caSurvivalInput   = document.getElementById('caSurvivalInput');
  const caSurvivalValue   = document.getElementById('caSurvivalValue');
  const caBirthInput      = document.getElementById('caBirthInput');
  const caBirthValue      = document.getElementById('caBirthValue');
  function updateSliderOptions() {
    if (!dwContainer || !dwInput || !dwValue || !caContainer || !caIterationsInput) return;
    const algo = mazeAlgoSelect.value;
    dwContainer.style.display = 'none';
    caContainer.style.display = 'none';
    if (algo === 'drunkards_walk') {
      dwContainer.style.display = 'flex';
    } else if (algo === 'cellular_automata') {
      caContainer.style.display = 'flex';
    }
  }
  // Initialize sliders from localStorage or defaults
  // Drunkard's Walk
  { const saved = localStorage.getItem('drunkCoverage');
    dwInput.value = saved !== null ? saved : 50;
    dwValue.textContent = `${dwInput.value}%`;
  }
  // Cellular Automata: iterations, fill, survival, birth
  { const s = localStorage.getItem('caIterations');
    caIterationsInput.value = s !== null ? s : 3;
    caIterationsValue.textContent = `${caIterationsInput.value}`;
  }
  { const s = localStorage.getItem('caFill');
    caFillInput.value = s !== null ? s : 45;
    caFillValue.textContent = `${caFillInput.value}%`;
  }
  { const s = localStorage.getItem('caSurvival');
    caSurvivalInput.value = s !== null ? s : 4;
    caSurvivalValue.textContent = `${caSurvivalInput.value}`;
  }
  { const s = localStorage.getItem('caBirth');
    caBirthInput.value = s !== null ? s : 5;
    caBirthValue.textContent = `${caBirthInput.value}`;
  }
  // Attach slider event handlers
  dwInput.addEventListener('input', () => {
    const v = dwInput.value;
    dwValue.textContent = `${v}%`;
    localStorage.setItem('drunkCoverage', v);
    if (mazeAlgoSelect.value === 'drunkards_walk') generateNewMaze();
  });
  caIterationsInput.addEventListener('input', () => {
    const v = caIterationsInput.value;
    caIterationsValue.textContent = `${v}`;
    localStorage.setItem('caIterations', v);
    if (mazeAlgoSelect.value === 'cellular_automata') generateNewMaze();
  });
  caFillInput.addEventListener('input', () => {
    const v = caFillInput.value;
    caFillValue.textContent = `${v}%`;
    localStorage.setItem('caFill', v);
    if (mazeAlgoSelect.value === 'cellular_automata') generateNewMaze();
  });
  caSurvivalInput.addEventListener('input', () => {
    const v = caSurvivalInput.value;
    caSurvivalValue.textContent = `${v}`;
    localStorage.setItem('caSurvival', v);
    if (mazeAlgoSelect.value === 'cellular_automata') generateNewMaze();
  });
  caBirthInput.addEventListener('input', () => {
    const v = caBirthInput.value;
    caBirthValue.textContent = `${v}`;
    localStorage.setItem('caBirth', v);
    if (mazeAlgoSelect.value === 'cellular_automata') generateNewMaze();
  });
  // Initialize panel visibility
  updateSliderOptions();
  solveAlgoSelect.addEventListener('change', () => {
    localStorage.setItem('solveAlgo', solveAlgoSelect.value);
    reSolve(generationToken);
  });
  solveDirSelect.addEventListener('change', () => {
    localStorage.setItem('solveDir', solveDirSelect.value);
    generationToken++;
    reSolve(generationToken);
  });

  
  mazeAlgoSelect.addEventListener('change', () => {
    localStorage.setItem('mazeAlgo', mazeAlgoSelect.value);
    updateSliderOptions();
    generateNewMaze();
  });

  function handleNext() {
    updateSliderOptions();
    generateNewMaze();
  }

  // Removed duplicate Next/Space handler: unified in main controls below

  // Next button: unified handler
  document.getElementById('nextBtn').addEventListener('click', handleNext);
  document.addEventListener('keydown', e => {
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        generateNewMaze();
        break;
      case 'ArrowUp':
        e.preventDefault();
        mazeAlgoSelect.selectedIndex = (mazeAlgoSelect.selectedIndex - 1 + mazeAlgoSelect.options.length) % mazeAlgoSelect.options.length;
        mazeAlgoSelect.dispatchEvent(new Event('change'));
        break;
      case 'ArrowDown':
        e.preventDefault();
        mazeAlgoSelect.selectedIndex = (mazeAlgoSelect.selectedIndex + 1) % mazeAlgoSelect.options.length;
        mazeAlgoSelect.dispatchEvent(new Event('change'));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        solveAlgoSelect.selectedIndex = (solveAlgoSelect.selectedIndex - 1 + solveAlgoSelect.options.length) % solveAlgoSelect.options.length;
        localStorage.setItem('solveAlgo', solveAlgoSelect.value);
        generationToken++;
        reSolve(generationToken);
        break;
      case 'ArrowRight':
        e.preventDefault();
        solveAlgoSelect.selectedIndex = (solveAlgoSelect.selectedIndex + 1) % solveAlgoSelect.options.length;
        localStorage.setItem('solveAlgo', solveAlgoSelect.value);
        generationToken++;
        reSolve(generationToken);
        break;
      case 'ShiftRight':
        e.preventDefault();
        solveDirSelect.selectedIndex = (solveDirSelect.selectedIndex + 1) % solveDirSelect.options.length;
        localStorage.setItem('solveDir', solveDirSelect.value);
        generationToken++;
        reSolve(generationToken);
        break;
      default:
        break;
    }
  });

  // Draw a single cell at (x, y) as passage (white)
  function drawCell(x, y) {
    mazeCanvas.drawCell(x, y);
  }

  // Draw a checked cell (closedSet) in dark gray
  function drawClosedCell(x, y) {
    ctx.fillStyle = '#555';
    ctx.fillRect(
      offsetX + x * cellSize,
      offsetY + y * cellSize,
      cellSize,
      cellSize
    );
  }

  // Draw a path cell in blue
  function drawPathCell(x, y) {
    ctx.fillStyle = 'blue';
    ctx.fillRect(
      offsetX + x * cellSize,
      offsetY + y * cellSize,
      cellSize,
      cellSize
    );
  }
  // Draw heatmap cell for random-walk: visits count gradient from white->blue
  // count: number of times visited (>=1), max: maximum visit count observed
  function drawVisitCell(x, y, count, max) {
    // Compute normalized position in [0..1]: visits=1 -> 0 (light blue), visits=max -> 1 (full blue)
    const ratio = max > 1 ? (count - 1) / (max - 1) : 0;
    const minChannel = 200;
    const channel = Math.round(minChannel * (1 - ratio));
    ctx.fillStyle = `rgb(${channel},${channel},255)`;
    ctx.fillRect(
      offsetX + x * cellSize,
      offsetY + y * cellSize,
      cellSize,
      cellSize
    );
  }
  // Draw the random-walk pointer as a red circle filling 85% of the cell
  function drawPointer(x, y) {
    const cx = offsetX + x * cellSize + cellSize / 2;
    const cy = offsetY + y * cellSize + cellSize / 2;
    const radius = (cellSize / 2) * 0.85;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Draw the Wilson walk path cell in dark gray (uncommitted)
  function drawWalkCell(x, y) {
    ctx.fillStyle = '#555';
    ctx.fillRect(
      offsetX + x * cellSize,
      offsetY + y * cellSize,
      cellSize,
      cellSize
    );
  }
  // Clear a cell back to wall (black)
  function drawWallCell(x, y) {
    ctx.fillStyle = 'black';
    ctx.fillRect(
      offsetX + x * cellSize,
      offsetY + y * cellSize,
      cellSize,
      cellSize
    );
  }

  // Draw marker cell with letter
  function drawMarker(x, y, color, letter) {
    mazeCanvas.drawMarker(x, y, color, letter);
  }

  // Manhattan distance heuristic
  function heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  // Reconstruct path from cameFrom map
  function reconstructPath(cameFrom, cx, cy) {
    const path = [[cx, cy]];
    let x = cx, y = cy;
    while (cameFrom[y][x]) {
      const [px, py] = cameFrom[y][x];
      path.push([px, py]);
      x = px; y = py;
    }
    return path.reverse();
  }

  // Start solving with current maze state
  function startSolving(token) {
    if (token !== generationToken) return;
    
    const direction = solveDirSelect.value;
    const { start, goal } = mazeState.getDirectionalPositions(direction);
    
    // Create wrapper for reconstructPath to handle direction
    const baseReconstruct = reconstructPath;
    const recFn = (cf, cx, cy) => {
      const p = baseReconstruct(cf, cx, cy);
      return direction === 'forward' ? p : p.slice().reverse();
    };
    
    // Create wrapper for drawMarker to keep S/G at original positions
    const solveDrawMarker = (x, y, color, letter) => {
      if (letter === 'S') {
        drawMarker(mazeState.startPos.x, mazeState.startPos.y, color, letter);
      } else if (letter === 'G') {
        drawMarker(mazeState.goalPos.x, mazeState.goalPos.y, color, letter);
      }
    };
    
    // Run solver algorithm
    const solverAlgo = solvers[solveAlgoSelect.value];
    solverAlgo.solve(token, {
      rows, cols, grid,
      startX: start.x, startY: start.y, goalX: goal.x, goalY: goal.y,
      drawCell, drawClosedCell, drawPathCell,
      drawMarker: solveDrawMarker,
      // For random-walk solver: heatmap & pointer
      drawVisitCell, drawPointer,
      stepsPerFrame,
      heuristic, reconstructPath: recFn,
      abortCheck: t => t === generationToken,
      requestAnimationFrame
    });
  }

  // After maze is fully carved, place start/goal and begin solve
  /**
   * After maze is fully carved, place start/goal and begin solve
   * @param {number} token  current generation token
   * @param {number=} sX    optional startX to use (validated by SearchFormer)
   * @param {number=} sY    optional startY
   * @param {number=} gX    optional goalX
   * @param {number=} gY    optional goalY
   */
  function finishMaze(token, sX, sY, gX, gY) {
    if (token !== generationToken) return;
    
    // Update state
    mazeState.setGrid(grid, rows, cols);
    mazeState.currentToken = token;
    
    // Select positions
    const providedStart = (typeof sX === 'number' && typeof sY === 'number') ? { x: sX, y: sY } : null;
    const providedGoal = (typeof gX === 'number' && typeof gY === 'number') ? { x: gX, y: gY } : null;
    const { start, goal } = PositionSelector.selectStartAndGoal(grid, rows, cols, providedStart, providedGoal);
    
    // Update state
    mazeState.setPositions(start, goal);
    
    // Draw markers
    mazeCanvas.drawMarkers(start, goal);
    
    // Start solving
    startSolving(token);
  }

  // Re-solve the current maze with the selected solver (clear old trace)
  function reSolve(token) {
    if (token !== generationToken) return;
    
    // Clear previous solution
    mazeCanvas.clearSolution(grid, rows, cols);
    mazeCanvas.drawMarkers(mazeState.startPos, mazeState.goalPos);
    
    // Update token
    mazeState.currentToken = token;
    
    // Start solving
    startSolving(token);
  }

  // Generate a new maze
  function generateNewMaze() {
    const algo = mazeAlgoSelect.value;
    generationToken++;
    const token = generationToken;
    // Initialize grid & stack for generation
    grid = Array(rows).fill(null).map(() => Array(cols).fill(0));
    stack = [];
    // Clear canvas
    ctx.fillStyle = 'black'; ctx.fillRect(0, 0, width, height);
    // Determine algorithm parameters from individual sliders
    // const algo = mazeAlgoSelect.value;  // already read above
    let coverage, iterations, fillProb, survival, birth;
    if (algo === 'drunkards_walk') {
      coverage = parseFloat(dwInput.value) / 100;
    } else if (algo === 'cellular_automata') {
      iterations = parseInt(caIterationsInput.value, 10);
      fillProb   = parseFloat(caFillInput.value) / 100;
      survival   = parseInt(caSurvivalInput.value, 10);
      birth      = parseInt(caBirthInput.value, 10);
    }
    const genAlgo = generators[algo];
    if (genAlgo === generators.dfs) {
      // Random carve-start cell for DFS
      carveStartX = Math.floor(Math.random() * cols);
      carveStartY = Math.floor(Math.random() * rows);
      grid[carveStartY][carveStartX] = 1;
      drawCell(carveStartX, carveStartY);
      stack.push([carveStartX, carveStartY]);
    }
    genAlgo.generate(token, {
      rows, cols, grid, stack,
      drawCell,
      stepsPerFrame,
      finishMaze,
      // Drunkard's Walk
      coverage,
      // Cellular Automata
      iterations,
      fillProbability: fillProb,
      survivalThreshold: survival,
      birthThreshold: birth,
      // allow generator to clear & reset drawing when retrying
      clearGrid: () => {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        for (let yy = 0; yy < rows; yy++) {
          for (let xx = 0; xx < cols; xx++) {
            grid[yy][xx] = 0;
          }
        }
      },
      // Canvas-only clear (preserves grid state)
      clearCanvas: () => {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
      },
      // Walk visualization for Wilson's algorithm
      drawWalkCell, drawWallCell,
      abortCheck: t => t === generationToken,
      requestAnimationFrame
    });
  }

  // Auto-start: generate a new maze
  generateNewMaze();


});
