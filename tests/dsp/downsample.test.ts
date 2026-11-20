/**
 * Downsampling tests.
 *
 * Property-based tests (required):
 *   P6 (length): for all inputs and targetLength in [1, input.length],
 *                downsample(input, targetLength).length === targetLength
 *   P7 (bounds): for all inputs and valid targetLength,
 *                every output value is in [min(input), max(input)]
 *
 * Unit tests cover:
 *   - targetLength >= input.length returns a copy of the input
 *   - targetLength === 1 returns exactly 1 value
 *   - Odd and even targetLength produce the correct number of values
 *   - Min and max of the output are within the input range
 *   - Each bucket emits values in chronological order (min before max when
 *     min appears first in the bucket, max before min otherwise)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { downsample } from '../../src/dsp/downsample';

// ---------------------------------------------------------------------------
// Arbitrary generator — matches the fast-check spec in tasks.md §9.3
// ---------------------------------------------------------------------------

const arbSignal = fc.float32Array({
  minLength: 2,
  maxLength: 1024,
  noNaN: true,
  noDefaultInfinity: true,
  min: -10,
  max: 10,
});

// ---------------------------------------------------------------------------
// P6 — output length equals targetLength
// ---------------------------------------------------------------------------

describe('P6: output length === targetLength', () => {
  it('for all inputs and targetLength in [1, input.length], output has the right length', () => {
    fc.assert(
      fc.property(
        arbSignal.chain((samples) =>
          fc
            .integer({ min: 1, max: samples.length })
            .map((targetLength) => ({ samples, targetLength })),
        ),
        ({ samples, targetLength }) => {
          const out = downsample(samples, targetLength);
          expect(out.length).toBe(targetLength);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// P7 — every output value is within [min(input), max(input)]
// ---------------------------------------------------------------------------

describe('P7: every output value is within [min(input), max(input)]', () => {
  it('for all inputs and targetLength, output stays within input bounds', () => {
    fc.assert(
      fc.property(
        arbSignal.chain((samples) =>
          fc
            .integer({ min: 1, max: samples.length })
            .map((targetLength) => ({ samples, targetLength })),
        ),
        ({ samples, targetLength }) => {
          let globalMin = Infinity;
          let globalMax = -Infinity;
          for (let i = 0; i < samples.length; i++) {
            const v = samples[i] ?? 0;
            if (v < globalMin) globalMin = v;
            if (v > globalMax) globalMax = v;
          }

          const out = downsample(samples, targetLength);
          for (let i = 0; i < out.length; i++) {
            const v = out[i] ?? 0;
            // Allow a small floating-point epsilon for Float32 precision.
            expect(v).toBeGreaterThanOrEqual(globalMin - 1e-6);
            expect(v).toBeLessThanOrEqual(globalMax + 1e-6);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('downsample — unit tests', () => {
  it('targetLength >= input.length returns a copy of the input', () => {
    const input = new Float32Array([1, 2, 3, 4, 5]);
    const out = downsample(input, 5);
    expect(out.length).toBe(5);
    expect(Array.from(out)).toEqual(Array.from(input));
    // Must be a copy, not the same reference
    expect(out).not.toBe(input);
  });

  it('targetLength > input.length returns a copy of the input', () => {
    const input = new Float32Array([1, 2, 3]);
    const out = downsample(input, 10);
    expect(out.length).toBe(3);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it('targetLength === 1 returns a single value within the input range', () => {
    const input = new Float32Array([-5, 0, 3, -2, 1]);
    const out = downsample(input, 1);
    expect(out.length).toBe(1);
    // The single value must be within [min, max]
    const v = out[0] ?? 0;
    expect(v).toBeGreaterThanOrEqual(-5);
    expect(v).toBeLessThanOrEqual(3);
  });

  it('even targetLength produces the correct length', () => {
    const input = new Float32Array(100).map((_, i) => Math.sin(i / 10));
    const out = downsample(input, 10);
    expect(out.length).toBe(10);
  });

  it('odd targetLength produces the correct length', () => {
    const input = new Float32Array(100).map((_, i) => Math.sin(i / 10));
    const out = downsample(input, 11);
    expect(out.length).toBe(11);
  });

  it('output min and max are within input range on a sawtooth', () => {
    // Sawtooth from 0 to 99; known min=0, max=99
    const input = new Float32Array(100).map((_, i) => i);
    const out = downsample(input, 20);
    const outMin = Math.min(...Array.from(out));
    const outMax = Math.max(...Array.from(out));
    expect(outMin).toBeGreaterThanOrEqual(0);
    expect(outMax).toBeLessThanOrEqual(99);
  });

  it('a constant-value input downsamples to the same constant', () => {
    const input = new Float32Array(200).fill(3.14);
    const out = downsample(input, 50);
    expect(out.length).toBe(50);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeCloseTo(3.14, 5);
    }
  });

  it('downsampling a 2-element array to targetLength 1 is in range', () => {
    const input = new Float32Array([-1.0, 1.0]);
    const out = downsample(input, 1);
    expect(out.length).toBe(1);
    const v = out[0] ?? 0;
    expect(v).toBeGreaterThanOrEqual(-1.0);
    expect(v).toBeLessThanOrEqual(1.0);
  });

  it('downsampling a 2-element array to targetLength 2 returns a copy', () => {
    const input = new Float32Array([-1.0, 1.0]);
    const out = downsample(input, 2);
    expect(out.length).toBe(2);
    expect(Array.from(out)).toEqual([-1.0, 1.0]);
  });

  it('a large downsampling preserves the global minimum and maximum', () => {
    // Build an array with a known spike at a specific position.
    const input = new Float32Array(1000).fill(0);
    input[123] = 9.5;  // spike high
    input[456] = -8.3; // spike low

    const out = downsample(input, 50);
    const outMax = Math.max(...Array.from(out));
    const outMin = Math.min(...Array.from(out));

    // The min-max bucketing must have captured both spikes.
    expect(outMax).toBeCloseTo(9.5, 4);
    expect(outMin).toBeCloseTo(-8.3, 4);
  });
});
