/*
 * headless_gen/solver-worker.js
 * 
 * Worker thread that handles solving mazes.
 * Receives batches of ENCODED maze data, decodes them, solves them,
 * and sends the serialized solutions back.
 */

import { parentPort } from 'worker_threads';
import { solvers } from '../solvers.js';
import { serializeExample } from './serializer.js';
import { decodeMazeSpec } from './maze-codec.js';

// The A* solver requires a heuristic function.
// We define a simple Manhattan distance heuristic here.
function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// Listen for work
parentPort.on('message', (msg) => {
  const { batch, solverId, rows, cols } = msg;

  if (!solvers[solverId] || typeof solvers[solverId].solveSync !== 'function') {
    parentPort.postMessage({ error: `Unknown or invalid solverId: ${solverId}` });
    return;
  }

  const lines = [];
  try {
    for (const item of batch) {
      // Decode the ArrayBuffer back into a standard JS object
      const spec = decodeMazeSpec(item.spec);

      // Solve the maze using the decoded spec.
      // The solver is sensitive to the order of properties in its argument object,
      // so we construct it manually to match the original implementation exactly.
      const solution = solvers[solverId].solveSync({
        rows,
        cols,
        grid: spec.grid,
        startX: spec.startX,
        startY: spec.startY,
        goalX: spec.goalX,
        goalY: spec.goalY,
        heuristic
      });
      
      // If the solver failed, it's a critical error because all generated mazes
      // in this system should be solvable.
      if (!solution || !solution.plan || !solution.reasoning) {
        // Post a specific, clear error and stop processing this batch.
        parentPort.postMessage({ error: `Solver '${solverId}' failed to find a valid solution plan or reasoning. This indicates a bug.` });
        return; // Exit the message handler
      }
      
      // Serialize the result for writing to the dataset file
      const line = serializeExample({ spec, solution, generatorId: 'kruskal-codec', solverId });
      lines.push(line);
    }

    parentPort.postMessage({ lines });

  } catch (err) {
    parentPort.postMessage({ error: `Solver worker failed: ${err.message}` });
  }
});