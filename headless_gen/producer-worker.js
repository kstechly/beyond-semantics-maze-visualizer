/*
 * headless_gen/producer-worker.js
 * 
 * Worker thread that handles maze generation with backpressure and dynamic batching.
 * It generates mazes only when it has "credits" and sends them in batches.
 * Credits are granted by the main thread, effectively pausing this worker if consumers are slow.
 */

import { parentPort } from 'worker_threads';
import { seedLCG } from './rng.js';
import { generators } from '../generators.js';
import { encodeMazeSpec } from './maze-codec.js';

let config;
let credits = 0;
let notifyCreditAvailable = null;

/**
 * Main message handler for the worker.
 * Manages initialization, credits, and configuration updates.
 */
parentPort.on('message', (msg) => {
  switch (msg.type) {
    case 'init':
      config = msg.config;
      credits = msg.initialCredits;
      // Start the generation process
      generate();
      break;
    
    case 'credit':
      credits += msg.count;
      // If the generator is waiting for a credit, notify it to resume.
      if (notifyCreditAvailable) {
        notifyCreditAvailable();
        notifyCreditAvailable = null;
      }
      break;
    
    case 'update_batch_size':
      if (config) {
        config.batchSize = msg.newBatchSize;
      }
      break;
  }
});

/**
 * The core maze generation loop.
 * This function runs until all requested mazes are generated, respecting the backpressure system.
 */
async function generate() {
  try {
    const {
      rows,
      cols,
      mode,
      seed,
      count,
      generatorId,
      generatorParams = {},
    } = config;

    // Validate generator
    if (!generators[generatorId]) {
      throw new Error(`Unknown generatorId: ${generatorId}`);
    }
    if (typeof generators[generatorId].generateSync !== 'function') {
      throw new Error(`Generator ${generatorId} lacks generateSync`);
    }

    // Initialize PRNG with same logic as main implementation
    const modeBit = mode === 'test' ? 1 : 0;
    const prngSeed = (seed * 2 + modeBit) >>> 0;
    const prng = seedLCG(prngSeed);

    let generatedCount = 0;

    // Generate mazes until the total count is reached
    while (generatedCount < count) {
      // --- Backpressure Check ---
      // Wait here until we have at least one credit.
      while (credits <= 0) {
        await new Promise(resolve => {
          notifyCreditAvailable = resolve;
        });
      }
      credits--; // Spend one credit to generate a batch

      const currentBatchSize = config.batchSize; // Use the potentially updated batch size
      const batchStart = generatedCount;
      const batchEnd = Math.min(batchStart + currentBatchSize, count);
      const batch = [];

      try {
        // Generate all mazes in this batch
        for (let idx = batchStart; idx < batchEnd; idx++) {
          // Use the single, stateful PRNG instance for all maze generation.
          // This exactly replicates the behavior of the original sequential pipeline,
          // ensuring the generated data is byte-for-byte identical.
          const spec = generators[generatorId].generateSync({ 
            rows, 
            cols, 
            prng,
            ...generatorParams  // Spread any additional params
          });
          const encodedSpec = encodeMazeSpec(spec);
          batch.push({ idx, spec: encodedSpec });
        }
        
        generatedCount += batch.length;

        // Send progress updates frequently
        parentPort.postMessage({ 
          type: 'progress', 
          generated: generatedCount 
        });

        // Send completed batch
        const transferList = batch.map(item => item.spec);
        parentPort.postMessage({
          type: 'batch',
          batchStart,
          batch,
          generated: generatedCount
        }, transferList);

      } catch (err) {
        // Critical error during generation - cannot continue!
        parentPort.postMessage({
          type: 'error',
          error: err.message,
          batchStart,
          failedIndex: batchStart + batch.length,
          generated: generatedCount
        });
        return; // Exit worker
      }
    }

    // Send final completion message
    parentPort.postMessage({
      type: 'complete',
      totalGenerated: generatedCount
    });

  } catch (err) {
    // Configuration or initialization error
    parentPort.postMessage({
      type: 'error',
      error: err.message,
      generated: 0
    });
  }
}