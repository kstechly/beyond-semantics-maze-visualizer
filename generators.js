import { dfs } from './generators/dfs.js';
import { searchformer } from './generators/searchformer.js';
import { kruskal } from './generators/kruskal.js';
import { wilson } from './generators/wilson.js';
import { cellular_automata } from './generators/cellular_automata.js';
import { drunkards_walk } from './generators/drunkards_walk.js';

// Unified maze generation algorithms registry
// Works in both browser and Node.js environments
export const generators = {
  dfs,
  kruskal,
  searchformer,
  wilson,
  drunkards_walk,
  cellular_automata
};