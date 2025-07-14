# Beyond Semantics -- Data Generation Utilities

This repository contains files for generating and visualizing maze datasets from the paper "[Beyond Semantics: The Unreasonable Effectiveness of Reasonless Intermediate Tokens](https://arxiv.org/abs/2505.13775)".

If you just want to visualize the mazes, you can use the `./serve` script to start a local server and open the visualization in your browser.

If you want to generate datasets that are bit-for-bit identical to the ones used in the paper, you can use the `headless_gen/cli.js` script. Details on usage are below.

If you just want to generate datasets of the same kind, but which use a different PRNG and so don't exactly duplicate the ones used in the paper, please instead go to [this repository](https://github.com/kstechly/beyond-semantics-maze-gen-fast), a much faster Rust rewrite.

## Visualization

Just run `./serve`. You can use the GUI or keyboard shortcuts: space to generate a new maze, up/down to change the maze generation algorithm, left/right to change the maze solving algorithm, and right shift to change the direction of the solving algorithm (e.g. start to goal, or goal to start).

## Basic CLI Usage

```bash
node headless_gen/cli.js --generator <name> --solver <name> [options]
```

### Required Arguments
- `--generator, -g` : Maze generator algorithm (see below for available generators)
- `--solver, -s` : Solver algorithm (`astar` is currently the only solver that generates traces)

### Optional Arguments
- `--rows, -r` : Grid rows (default: 30)
- `--cols, -c` : Grid columns (default: 30)
- `--mode, -m` : Dataset split - `train` or `test` (default: train)
- `--seed` : Base seed for generation (default: 42)
- `--count, -n` : Number of examples to generate (default: 1)
- `--batch-size` : Batch size for parallel processing (default: 500)
- `--output, -o` : Write to file instead of stdout
- `--help, -h` : Show help message
- **Any additional parameters** : Unrecognized options are passed directly to the generator as custom parameters. See below for the parameters supported by drunkards_walk and cellular_automata.

### Examples

Generate 50,000 Wilson train mazes and save to `wilson_50k.jsonl`:
```bash
node headless_gen/cli.js --generator wilson --solver astar --count 50000 -o wilson_50k.jsonl
```

Generate 1k drunkards walk test mazes with custom 70% coverage parameter and save to `drunkards_walk_1k_coverage_0.7.jsonl`:
```bash
node headless_gen/cli.js -g drunkards_walk -s astar --mode test --coverage 0.7 --count 1000 -o drunkards_walk_1k_coverage_0.7.jsonl
```

### Available Generators

If using parameterized generators, I recommend visualizing a few first in the browser interface to ensure they are generating the mazes you expect.

- `wilson` : Wilson's algorithm (loop-erased random walk. This is the training set generator from the paper)
- `cellular_automata` : Cellular automata-based maze generation (supports `--fillProbability`, `--survivalThreshold`, `--birthThreshold`, `--iterations` parameters)
- `dfs` : Depth-first search (recursive backtracker)
- `drunkards_walk` : Random walk algorithm (supports `--coverage` parameter)
- `kruskal` : Randomized Kruskal's algorithm 
- `searchformer` : Searchformer-specific maze generation

#### drunkards_walk parameters
- **Parameter**: `--coverage` (default: 0.5)
- **Description**: Controls the percentage of the grid that should be carved as passages (0.0-1.0)
- **Example**: `--coverage 0.7` creates a maze with 70% of cells as passages

#### cellular_automata parameters
- **Parameter**: `--fillProbability` (default: 0.45)
  - **Description**: Initial probability that a cell is a wall (0.0-1.0)
- **Parameter**: `--survivalThreshold` (default: 4)
  - **Description**: Walls survive if they have fewer than this many alive neighbors
- **Parameter**: `--birthThreshold` (default: 5)
  - **Description**: Empty cells become walls if they have more than this many alive neighbors
- **Parameter**: `--iterations` (default: 3)
  - **Description**: Number of cellular automata iterations to run