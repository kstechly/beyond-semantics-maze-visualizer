/*
 * headless_gen/producer-consumer.js
 *
 * Producer-consumer pattern for parallel dataset generation.
 * - Single producer generates mazes sequentially (preserving PRNG order)
 * - Multiple consumers solve mazes in parallel
 * - Results are written in generation order
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));


/**
 * Parallel dataset generation with dedicated producer worker.
 * Maze generation happens in a separate thread to prevent blocking.
 * 
 * @param {Object} opts - Generation options
 * @param {Object} config - Configuration options
 * @returns {AsyncGenerator<string>}
 */
export async function* generateDatasetParallel(opts, config = {}) {
  const {
    rows = 30,
    cols = 30,
    mode = 'train',
    seed = 42,
    count = 1,
    generatorId,
    solverId,
  } = opts;

  const {
    workers: requestedWorkers,
    batchSize = 500,
    // Max number of batches to buffer in memory from the producer.
    // This is the total number of "credits" in the backpressure system.
    producerBuffer = 9,
    // The largest batch size the dynamic system can increase to.
    // Reduced from 5000 to 2000 to prevent heap memory errors in workers.
    maxBatchSize = 2000,
    onProgress = null
  } = config;

  // Validate solver (generator validation happens in worker)
  const { solvers } = await import('../solvers.js');
  if (!solvers[solverId]) {
    throw new Error(`Unknown solverId: ${solverId}`);
  }

  // Determine optimal worker count for solvers, leaving cores for producer and main thread
  const cpuCount = os.cpus().length;
  let numWorkers = requestedWorkers || Math.max(1, cpuCount - 2);
  numWorkers = Math.min(numWorkers, count);
  if (count < 100) {
    numWorkers = Math.min(2, numWorkers);
  }

  // Track the current batch size, which can be changed dynamically.
  let currentBatchSize = batchSize;

  // Create producer worker
  const producerWorker = new Worker(join(__dirname, 'producer-worker.js'));
  
  // Create solver worker pool
  const solverWorkers = [];
  const availableWorkers = [];
  let notifyWorkerAvailable = null;
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(join(__dirname, 'solver-worker.js'));
    solverWorkers.push(worker);
    availableWorkers.push(worker);
  }

  // Batch tracking
  const generatedBatchQueue = [];
  const batchPromises = new Map();
  let nextYieldIdx = 0;
  let generationComplete = false;
  let generationError = null;
  let stats = {
    generated: 0,
    solved: 0,
    saved: 0
  };

  // Pre-create promise placeholders for all batches
  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    let resolveFunc;
    const promise = new Promise(resolve => { resolveFunc = resolve; });
    batchPromises.set(batchStart, { promise, resolve: resolveFunc });
  }

  // Promise to track when a new batch arrives
  let notifyNewBatch = null;

  try {
    // Set up producer worker listener
    producerWorker.on('message', (msg) => {
      switch (msg.type) {
        case 'batch':
          // Add batch to queue
          generatedBatchQueue.push({
            batchStart: msg.batchStart,
            batch: msg.batch
          });
          stats.generated = msg.generated;
          
          // Notify dispatcher if waiting
          if (notifyNewBatch) {
            notifyNewBatch();
            notifyNewBatch = null;
          }
          
          if (onProgress) {
            onProgress('generated', stats.generated);
          }
          break;
          
        case 'progress':
          stats.generated = msg.generated;
          if (onProgress) {
            onProgress('generated', stats.generated);
          }
          break;
          
        case 'complete':
          generationComplete = true;
          if (notifyNewBatch) {
            notifyNewBatch();
            notifyNewBatch = null;
          }
          break;
          
        case 'error':
          generationError = new Error(`Producer error: ${msg.error} (failed at index ${msg.failedIndex || 'unknown'})`);
          generationComplete = true;
          if (notifyNewBatch) {
            notifyNewBatch();
            notifyNewBatch = null;
          }
          break;
      }
    });

    // Start producer with initial configuration and credits
    producerWorker.postMessage({
      type: 'init',
      config: { 
        rows, 
        cols, 
        mode, 
        seed, 
        count, 
        generatorId, 
        batchSize: currentBatchSize,
        generatorParams: opts.generatorParams || {}
      },
      initialCredits: producerBuffer
    });

    // Dispatcher function - coordinates between producer and solvers
    const dispatcher = async () => {
      let dispatchedBatchCount = 0; // Counter for warm-up period

      while (!generationComplete || generatedBatchQueue.length > 0) {
        // Report current system state for progress display
        if (onProgress) {
          onProgress('system_state', {
            queueSize: generatedBatchQueue.length,
            waitingWorkers: availableWorkers.length
          });
        }
        
        // Check for generation error
        if (generationError) {
          throw generationError;
        }

        // Try to dispatch work
        if (generatedBatchQueue.length > 0 && availableWorkers.length > 0) {
          dispatchedBatchCount++; // Increment for each batch dispatched
          const { batchStart, batch } = generatedBatchQueue.shift();
          const worker = availableWorkers.shift();
          
          // --- Backpressure ---
          // A slot in the queue was freed, so grant a new credit to the producer.
          producerWorker.postMessage({ type: 'credit', count: 1 });

          // --- Dynamic Batching ---
          // Give the pipeline time to warm up before changing the batch size.
          // This prevents premature and aggressive batch size increases.
          const isWarmedUp = dispatchedBatchCount > numWorkers + 1;

          // If solvers are waiting and our queue is empty, generation is the bottleneck.
          // Increase the batch size to reduce message overhead and improve throughput.
          if (isWarmedUp && generatedBatchQueue.length === 0 && availableWorkers.length > 0 && currentBatchSize < maxBatchSize) {
            currentBatchSize = Math.min(currentBatchSize * 2, maxBatchSize);
            producerWorker.postMessage({ type: 'update_batch_size', newBatchSize: currentBatchSize });
            if (onProgress) {
              onProgress('config_change', { batchSize: currentBatchSize });
            }
          }
          
          // Create work promise
          const workPromise = new Promise((resolve, reject) => {
            const messageHandler = (msg) => {
              if (msg.error) {
                reject(new Error(msg.error));
                return;
              }
              
              stats.solved += msg.lines.length;
              
              // Resolve the batch promise for the consumer
              const batchPromise = batchPromises.get(batchStart);
              if (batchPromise) {
                batchPromise.resolve(msg.lines);
              }
              
              // Return worker to pool
              availableWorkers.push(worker);
              if (notifyWorkerAvailable) {
                notifyWorkerAvailable();
                notifyWorkerAvailable = null;
              }
              
              worker.off('message', messageHandler);
              
              if (onProgress) {
                onProgress('solved', stats.solved);
              }
              
              resolve();
            };
            
            worker.on('message', messageHandler);

            // Directly transfer the encoded maze data (ArrayBuffers) to the solver worker.
            // This avoids the costly deserialize/re-serialize step on the main thread.
            const transferList = batch.map(item => item.spec);
            worker.postMessage({
              batch,
              solverId,
              rows,
              cols
            }, transferList);
          });
          
          // Handle errors but don't await
          workPromise.catch(err => {
            generationError = err;
            console.error(`Solver error for batch starting at ${batchStart}:`, err);
          });
          
        } else {
          // Wait for either new batch or available worker
          const waitPromises = [];
          
          if (generatedBatchQueue.length === 0 && !generationComplete) {
            // Need to wait for new batch
            waitPromises.push(new Promise(resolve => {
              notifyNewBatch = resolve;
            }));
          }
          
          if (availableWorkers.length === 0 && stats.solved < count) {
            // Need to wait for available worker
            waitPromises.push(new Promise(resolve => {
              notifyWorkerAvailable = resolve;
            }));
          }
          
          if (waitPromises.length > 0) {
            await Promise.race(waitPromises);
          } else if (generationComplete && generatedBatchQueue.length === 0 && stats.solved >= count) {
            // All done - exit the loop
            break;
          } else {
            // This shouldn't happen, but if it does, wait a bit longer
            // to avoid tight loop that could starve the consumer
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      }
    };

    // Start dispatcher
    const dispatcherPromise = dispatcher();

    // Consumer - yield results in order
    while (nextYieldIdx < count) {
      const batchStart = Math.floor(nextYieldIdx / batchSize) * batchSize;
      
      // Wait for the batch
      const batchPromise = batchPromises.get(batchStart);
      const lines = await batchPromise.promise;
      
      // Check for errors before yielding
      if (generationError) {
        throw generationError;
      }
      
      // Yield entire batch at once
      const endIdx = Math.min(batchStart + lines.length, count);
      const linesToYield = lines.slice(0, endIdx - batchStart);
      
      yield { type: 'batch', lines: linesToYield };
      
      stats.saved += linesToYield.length;
      nextYieldIdx = endIdx;
      
      if (onProgress) {
        onProgress('saved', stats.saved);
      }
      
      // Free memory
      if (nextYieldIdx >= batchStart + lines.length) {
        batchPromises.delete(batchStart);
      }
    }

    // Wait for dispatcher to finish
    await dispatcherPromise;

    // Final progress update
    if (onProgress) {
      onProgress('complete', count);
    }

  } finally {
    // Clean up all workers
    producerWorker.terminate();
    for (const worker of solverWorkers) {
      worker.terminate();
    }
  }
}

/**
 * Convenience wrapper with built-in progress bar
 */
export async function* generateDatasetWithProgress(opts, config = {}) {
  const { count = 1 } = opts;
  const startTime = Date.now();
  
  // Track all three phases
  let stats = {
    generated: 0,
    solved: 0,
    saved: 0,
    // Track dynamic config changes
    batchSize: config.batchSize || 500,
    // Track system state
    queueSize: 0,
    waitingWorkers: 0
  };
  
  // Multi-bar progress display
  const updateProgress = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = stats.saved / elapsed || 0;
    const eta = (count - stats.saved) / rate || 0;
    
    // Generate three bars
    const makeBar = (current, total, width = 30) => {
      const percentage = Math.floor((current / total) * 100);
      const filled = Math.floor((current / total) * width);
      const empty = width - filled;
      return `[${('█'.repeat(filled) + '░'.repeat(empty)).padEnd(width)}] ${percentage.toString().padStart(3)}%`;
    };
    
    // Clear previous lines (3 bars + 1 stats line)
    process.stderr.write('\r\x1b[K');  // Clear current line
    process.stderr.write('\x1b[3A');   // Move up 3 lines
    process.stderr.write('\r\x1b[K');  // Clear each line
    
    // Display bars
    process.stderr.write(`Generate: ${makeBar(stats.generated, count)} ${stats.generated}/${count}\n`);
    process.stderr.write(`Solve:    ${makeBar(stats.solved, count)} ${stats.solved}/${count}\n`);
    process.stderr.write(`Save:     ${makeBar(stats.saved, count)} ${stats.saved}/${count}\n`);
    process.stderr.write(`Speed: ${rate.toFixed(0)} mazes/s | ETA: ${eta.toFixed(0)}s | Batch: ${stats.batchSize} | Q: ${stats.queueSize} | W: ${stats.waitingWorkers}`);
  };
  
  // Initial display
  process.stderr.write('\n\n\n\n');  // Make space for 4 lines
  updateProgress();
  
  // Progress callback
  const onProgress = (type, value) => {
    if (type === 'generated') stats.generated = value;
    else if (type === 'solved') stats.solved = value;
    else if (type === 'saved') stats.saved = value;
    else if (type === 'config_change') {
      if (value.batchSize) stats.batchSize = value.batchSize;
    } else if (type === 'system_state') {
      stats.queueSize = value.queueSize;
      stats.waitingWorkers = value.waitingWorkers;
    }
    updateProgress();
  };

  // Generate with progress - pass through batches
  for await (const item of generateDatasetParallel(opts, { ...config, onProgress })) {
    yield item;
  }
  
  // Move cursor below progress bars
  process.stderr.write('\n');
}