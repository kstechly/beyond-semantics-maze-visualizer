/*
 * headless_gen/serializer.js
 *
 * Pure utility that serialises a maze `spec` + solver output into the exact
 * JSONL format produced in `script.js` (see lines ~170–210).  The goal is
 * **byte-for-byte** compatibility so that `diff` shows no changes between
 * datasets generated here and in the browser.
 */

/**
 * @typedef {Object} MazeSpec
 * @property {number[][]} grid   Grid of 0 (wall) / 1 (passage)
 * @property {number} startX
 * @property {number} startY
 * @property {number} goalX
 * @property {number} goalY
 */

/**
 * Serialise one example to a JSON Lines string terminating with a `\n`.
 *
 * @param {MazeSpec} spec  – maze geometry
 * @param {Array<Array>} reasoning – flattened or nested arrays describing the solver trace
 * @param {Array<[number,number]>} plan – list of (x,y) path coordinates in order
 * @returns {string} Exact JSONL line as produced by the original browser code
 */
export function serializeExample({ spec, solution, generatorId, solverId }) {
  const { grid, startX, startY, goalX, goalY } = spec;
  const { reasoning, plan } = solution;
  const rows = grid.length;
  const cols = grid[0].length;

  // --- Build token array in the precise order expected by the consumer ---
  const tokens = ['query', 'start', startX, startY, 'goal', goalX, goalY];

  // Walls: iterate row-major, identical to the UI implementation.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) tokens.push('wall', x, y);
    }
  }

  // Reasoning events (already flattened inside browser code via spread).
  tokens.push('reasoning');
  for (const ev of reasoning) tokens.push(...ev);

  // Solution path.
  tokens.push('solution');
  for (const [x, y] of plan) tokens.push('plan', x, y);

  tokens.push('end');

  // Join with single spaces and wrap in JSON as {"text": "…"}\n
  const lineObj = { text: tokens.join(' ') };
  return JSON.stringify(lineObj) + '\n';
}