/*
 * headless_gen/index.js
 *
 * Public API for deterministic, headless dataset generation.  It stitches
 * together:
 *   • PRNG from `rng.js`
 *   • Maze generators and solvers from unified registries
 *   • Serialiser from `serializer.js`
 *
 * The implementation replicates the logic found in `script.js` so outputs are
 * byte-for-byte identical.  No browser globals are required, so it can be run
 * in Node, a worker thread, or a Lambda.
 */

import { seedLCG } from './rng.js';
import { generators } from '../generators.js';
import { solvers } from '../solvers.js';
import { serializeExample } from './serializer.js';

// Manhattan distance heuristic – must match `script.js` implementation.
function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Options for dataset generation (mirrors front-end UI).
 * @typedef {Object} GenerateOptions
 * @property {number} rows            Grid height (e.g. 30)
 * @property {number} cols            Grid width  (e.g. 30)
 * @property {string} mode            "train" | "test" (affects RNG stream)
 * @property {number} seed            Base seed – identical seeds give identical datasets
 * @property {number} count           Number of lines/examples to generate
 * @property {string} generatorId     Key in `generators` registry (e.g. "searchformer")
 * @property {string} solverId        Key in `solvers` registry (e.g. "astar")
 */

/**
 * Async generator that yields JSONL lines one by one, identical to the browser.
 *
 * Usage:
 *   for await (const line of generateDataset(opts)) { process.stdout.write(line); }
 *
 * @param {GenerateOptions} opts
 * @returns {AsyncGenerator<string>}
 */
export async function* generateDataset(opts) {
  const {
    rows = 30,
    cols = 30,
    mode = 'train',
    seed = 42,
    count = 1,
    generatorId,
    solverId,
  } = opts;

  if (!generators[generatorId]) {
    throw new Error(`Unknown generatorId: ${generatorId}`);
  }
  if (!solvers[solverId]) {
    throw new Error(`Unknown solverId: ${solverId}`);
  }
  if (typeof generators[generatorId].generateSync !== 'function') {
    throw new Error(`Generator ${generatorId} lacks generateSync`);
  }
  if (typeof solvers[solverId].solveSync !== 'function') {
    throw new Error(`Solver ${solverId} lacks solveSync – cannot be used for dataset generation`);
  }

  // Reproduce the PRNG seeding scheme used in the browser implementation.
  const modeBit = mode === 'test' ? 1 : 0;
  const prngSeed = (seed * 2 + modeBit) >>> 0; // >>>0 to keep unsigned 32-bit.
  const prng = seedLCG(prngSeed);

  for (let idx = 0; idx < count; idx++) {
    // 1. Generate maze spec.
    const spec = generators[generatorId].generateSync({ rows, cols, prng });

    // 2. Solve maze.
    const { reasoning, plan } = solvers[solverId].solveSync({
      rows,
      cols,
      grid: spec.grid,
      startX: spec.startX,
      startY: spec.startY,
      goalX: spec.goalX,
      goalY: spec.goalY,
      heuristic,
    });

    // 3. Serialize to JSONL.
    const line = serializeExample(spec, reasoning, plan);

    // 4. Yield.
    yield line;
  }
}

/**
 * Convenience helper that eagerly returns an array of lines.
 *
 * @param {GenerateOptions} opts
 * @returns {Promise<string[]>}
 */
export async function generateDatasetArray(opts) {
  const lines = [];
  for await (const line of generateDataset(opts)) {
    lines.push(line);
  }
  return lines;
}