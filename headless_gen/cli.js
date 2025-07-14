#!/usr/bin/env node
/*
 * headless_gen/cli.js
 *
 * Simple command-line interface to the headless maze dataset generator.
 * The CLI accepts the same knobs exposed by the browser UI and streams the
 * resulting JSONL either to STDOUT (default) or to a file provided via `-o`.
 *
 * Example:
 *   node headless_gen/cli.js --generator searchformer --solver astar \
 *        --mode train --seed 42 --count 50000 > train.jsonl
 */

import fs from 'fs';
import os from 'os';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { generateDatasetWithProgress } from './producer-consumer.js';

// ---------------- Parse args with yargs --------------
function parseArgs() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 [options]\n\nGenerate maze datasets with various algorithms and solvers.')
    .option('generator', {
      alias: 'g',
      describe: 'Maze generator to use',
      demandOption: true,
      type: 'string'
    })
    .option('solver', {
      alias: 's',
      describe: 'Solver to use',
      demandOption: true,
      type: 'string'
    })
    .option('rows', {
      alias: 'r',
      describe: 'Grid rows',
      default: 30,
      type: 'number'
    })
    .option('cols', {
      alias: 'c',
      describe: 'Grid columns',
      default: 30,
      type: 'number'
    })
    .option('mode', {
      alias: 'm',
      describe: 'Dataset split',
      choices: ['train', 'test'],
      default: 'train',
      type: 'string'
    })
    .option('seed', {
      describe: 'Base seed for generation',
      default: 42,
      type: 'number'
    })
    .option('count', {
      alias: 'n',
      describe: 'Number of examples to generate',
      default: 1,
      type: 'number'
    })
    .option('batch-size', {
      describe: 'Batch size for parallel processing',
      default: 500,
      type: 'number'
    })
    .option('output', {
      alias: 'o',
      describe: 'Write to file instead of stdout',
      type: 'string'
    })
    .example('$0 --generator dfs --solver astar --count 1000', 'Generate 1000 DFS mazes solved with A*')
    .example('$0 -g drunkards_walk -s bfs --coverage 0.7', 'Generate drunkards walk maze with 70% coverage')
    .help('help')
    .alias('help', 'h')
    .strict(false)  // Allow unknown options for generator params
    .parse();
}

// -------------------------------------------------------------------------

(async () => {
  const argv = parseArgs();
  
  // Extract known options and generator params
  const opts = {
    generatorId: argv.generator,
    solverId: argv.solver,
    rows: argv.rows,
    cols: argv.cols,
    mode: argv.mode,
    seed: argv.seed,
    count: argv.count,
    batchSize: argv.batchSize,
    output: argv.output,
    // All other options become generator params
    generatorParams: {}
  };
  
  // Extract unknown options as generator params
  const knownOptions = ['generator', 'g', 'solver', 's', 'rows', 'r', 'cols', 'c', 
                        'mode', 'm', 'seed', 'count', 'n', 'batch-size', 'batchSize',
                        'output', 'o', 'help', 'h', '_', '$0'];
  for (const [key, value] of Object.entries(argv)) {
    if (!knownOptions.includes(key)) {
      opts.generatorParams[key] = value;
    }
  }

  let outStream;
  if (opts.output) {
    outStream = fs.createWriteStream(opts.output, { flags: 'w' });
  } else {
    outStream = process.stdout;
  }

  // Validate generator and solver before starting
  const { generators } = await import('../generators.js');
  const { solvers } = await import('../solvers.js');
  
  if (!generators[opts.generatorId]) {
    const available = Object.keys(generators).sort();
    console.error(`\n[ERROR] Unknown generator: "${opts.generatorId}"`);
    console.error(`Available generators: ${available.join(', ')}`);
    
    // Suggest close matches
    const input = opts.generatorId.toLowerCase();
    const suggestions = available.filter(name => 
      name.toLowerCase().includes(input) || 
      input.includes(name.toLowerCase().replace('_', ''))
    );
    if (suggestions.length > 0) {
      console.error(`\nDid you mean: ${suggestions.join(' or ')}?`);
    }
    process.exit(1);
  }
  
  if (!solvers[opts.solverId]) {
    const available = Object.keys(solvers).sort();
    console.error(`\n[ERROR] Unknown solver: "${opts.solverId}"`);
    console.error(`Available solvers: ${available.join(', ')}`);
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    
    // Always use parallel generation with progress
    const workers = Math.max(1, os.cpus().length - 2); // Leave cores for producer and main thread
    
    process.stderr.write(`Using parallel generation with ${workers} solver threads...\n\n`);
    const generator = generateDatasetWithProgress(opts, { 
      workers,
      batchSize: opts.batchSize 
    });
    
    // Stream output
    let count = 0;
    for await (const item of generator) {
      // Always expect batches from parallel generation
      if (item && item.type === 'batch') {
        // Write batch of lines - join them for a single write
        const batchData = item.lines.join('');
        if (!outStream.write(batchData)) {
          // Backpressure handling – wait for drain
          await new Promise(res => outStream.once('drain', res));
        }
        count += item.lines.length;
      }
    }
    
    // Final summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (opts.count / (Date.now() - startTime) * 1000).toFixed(0);
    process.stderr.write(`✓ Generated ${opts.count} mazes in ${totalTime}s (${rate} mazes/sec)\n`);
  } catch (err) {
    console.error('\n[ERROR]', err.message);
    process.exitCode = 2;
  } finally {
    if (opts.output) outStream.end();
  }
})();