/**
 * Downsampling — pure function, no DOM, no store imports.
 *
 * downsample(input, targetLength) reduces a Float32Array to targetLength
 * samples using min-max bucketing so that signal peaks and troughs are
 * preserved even when the target length is much smaller than the input.
 *
 * Algorithm:
 *   - Divide the input into ceil(targetLength / 2) buckets.
 *   - Each bucket emits [min, max] in chronological order (whichever appears
 *     first in the bucket comes first in the output).
 *   - If targetLength is odd, the last bucket emits only its minimum value,
 *     bringing the total output length to exactly targetLength.
 *   - If targetLength >= input.length, return a copy of the input (no
 *     information is lost and the guarantee output.length === targetLength
 *     is not meaningful for upsampling).
 */

/**
 * Downsample a Float32Array to exactly targetLength values using min-max
 * bucketing.
 *
 * @param input         Source samples.
 * @param targetLength  Desired output length (must be >= 1).
 * @returns             New Float32Array of length targetLength, or a copy of
 *                      input when targetLength >= input.length.
 */
export function downsample(input: Float32Array, targetLength: number): Float32Array {
  if (targetLength >= input.length) {
    return input.slice();
  }

  const output = new Float32Array(targetLength);
  const numBuckets = Math.ceil(targetLength / 2);
  const isOddTarget = targetLength % 2 !== 0;

  let outputIndex = 0;

  for (let b = 0; b < numBuckets; b++) {
    // Compute the range of input indices for this bucket using floating-point
    // division to distribute the input as evenly as possible.
    const startF = (b * input.length) / numBuckets;
    const endF = ((b + 1) * input.length) / numBuckets;
    const start = Math.floor(startF);
    const end = Math.min(Math.floor(endF), input.length);

    if (start >= end) continue;

    // Find min, max and their positions within the bucket.
    let bucketMin = input[start] ?? 0;
    let bucketMax = input[start] ?? 0;
    let minIndex = start;
    let maxIndex = start;

    for (let i = start + 1; i < end; i++) {
      const v = input[i] ?? 0;
      if (v < bucketMin) {
        bucketMin = v;
        minIndex = i;
      }
      if (v > bucketMax) {
        bucketMax = v;
        maxIndex = i;
      }
    }

    // Last bucket with an odd targetLength: emit only the min value.
    if (isOddTarget && b === numBuckets - 1) {
      output[outputIndex++] = bucketMin;
    } else {
      // Emit min and max in chronological order.
      if (minIndex <= maxIndex) {
        output[outputIndex++] = bucketMin;
        output[outputIndex++] = bucketMax;
      } else {
        output[outputIndex++] = bucketMax;
        output[outputIndex++] = bucketMin;
      }
    }
  }

  return output;
}
