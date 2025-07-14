import { astar } from './solvers/astar.js';
import { bfs }   from './solvers/bfs.js';
import { dfs }   from './solvers/dfs.js';
import { random } from './solvers/random.js';

// Unified maze solving algorithms registry
// Works in both browser and Node.js environments
export const solvers = { astar, bfs, dfs, random };