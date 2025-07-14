// headless_gen/maze-codec.js

/**
 * Encodes a maze specification object into a transferable ArrayBuffer.
 *
 * The binary layout is as follows:
 * - Bytes 0-3:   Uint32 for `rows`
 * - Bytes 4-7:   Uint32 for `cols`
 * - Bytes 8-11:  Uint32 for `startX`
 * - Bytes 12-15: Uint32 for `startY`
 * - Bytes 16-19: Uint32 for `goalX`
 * - Bytes 20-23: Uint32 for `goalY`
 * - Bytes 24..:  Uint8 array for the grid data
 *
 * @param {object} spec - The maze spec { grid, startX, startY, goalX, goalY }
 * @returns {ArrayBuffer} - The encoded maze data.
 */
export function encodeMazeSpec(spec) {
  const { grid, startX, startY, goalX, goalY } = spec;
  const rows = grid.length;
  const cols = grid[0].length;

  // 6 metadata fields (32-bit) + grid data (8-bit per cell)
  const bufferSize = 24 + (rows * cols);
  const buffer = new ArrayBuffer(bufferSize);

  // Create a view for the 32-bit metadata at the start of the buffer
  const metadataView = new Uint32Array(buffer, 0, 6);
  metadataView[0] = rows;
  metadataView[1] = cols;
  metadataView[2] = startX;
  metadataView[3] = startY;
  metadataView[4] = goalX;
  metadataView[5] = goalY;

  // Create a view for the 8-bit grid data, starting after the metadata
  const gridView = new Uint8Array(buffer, 24);
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      gridView[i++] = grid[y][x];
    }
  }

  return buffer;
}

/**
 * Decodes an ArrayBuffer back into a maze specification object.
 * @param {ArrayBuffer} buffer - The ArrayBuffer containing the maze data.
 * @returns {{ grid: number[][], startX: number, startY: number, goalX: number, goalY: number }}
 */
export function decodeMazeSpec(buffer) {
  // Read metadata from the first 24 bytes
  const metadataView = new Uint32Array(buffer, 0, 6);
  const [rows, cols, startX, startY, goalX, goalY] = metadataView;

  // Read grid data from the rest of the buffer
  const gridView = new Uint8Array(buffer, 24);
  const grid = Array(rows).fill(null).map(() => Array(cols));

  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid[y][x] = gridView[i++];
    }
  }

  return { grid, startX, startY, goalX, goalY };
} 