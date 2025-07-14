/*
 * headless_gen/rng.js
 *
 * Small deterministic linear-congruential generator that is **bit-for-bit**
 * compatible with the `seedLCG` helper defined in `script.js`.
 *
 *   import { seedLCG } from './rng.js';
 *   const prng = seedLCG(42);
 *   console.log(prng());  // same output as the browser implementation
 *
 * Constants are taken from "Numerical Recipes" and match the ones hard-coded
 * in the existing front-end codebase.
 */

export function seedLCG(seed) {
  // Force unsigned 32-bit seed, mirroring the browser version.
  let state = seed >>> 0;

  // Return a closure that advances the internal state on each call and returns
  // a JS number in the interval [0, 1).
  return function () {
    // 32-bit LCG parameters (a = 1664525, c = 1013904223, m = 2^32).
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000; // Divide by 2^32 to get a float in [0,1).
  };
}