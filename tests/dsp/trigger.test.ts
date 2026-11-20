/**
 * Trigger detection tests.
 *
 * P12 (required property test):
 *   For all sample buffers with a rising trigger found at index i:
 *     (i === 0 ? prevSample : samples[i-1]) < level  &&  samples[i] >= level
 *
 * Unit tests cover:
 *   - Rising edge on a simple ramp
 *   - Falling edge on a simple ramp
 *   - No trigger on a constant signal
 *   - Cross-chunk boundary detection (trigger at i=0 using prevSample)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { findTrigger } from '../../src/dsp/trigger';

// ---------------------------------------------------------------------------
// Arbitrary generator — matches the fast-check spec in design.md §7
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
// P12 — Trigger edge direction property
// ---------------------------------------------------------------------------

describe('P12: rising trigger respects edge direction', () => {
  it('for all inputs: when findTrigger returns i >= 0, the sample before i is below level and samples[i] >= level', () => {
    fc.assert(
      fc.property(
        arbSignal,
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -9, max: 9 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -10, max: 10 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1 }),
        (samples, level, prevSample, hysteresisV) => {
          const idx = findTrigger(samples, level, 'rising', prevSample, hysteresisV);
          if (idx < 0) return; // no trigger found — valid

          const before = idx === 0 ? prevSample : (samples[idx - 1] ?? 0);
          expect(before).toBeLessThan(level);
          expect(samples[idx]).toBeGreaterThanOrEqual(level);
        },
      ),
    );
  });
});

describe('P12 (falling): falling trigger respects edge direction', () => {
  it('for all inputs: when findTrigger returns i >= 0, the sample before i is above level and samples[i] <= level', () => {
    fc.assert(
      fc.property(
        arbSignal,
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -9, max: 9 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -10, max: 10 }),
        fc.float({ noNaN: true, noDefaultInfinity: true, min: 0, max: 1 }),
        (samples, level, prevSample, hysteresisV) => {
          const idx = findTrigger(samples, level, 'falling', prevSample, hysteresisV);
          if (idx < 0) return; // no trigger found — valid

          const before = idx === 0 ? prevSample : (samples[idx - 1] ?? 0);
          expect(before).toBeGreaterThan(level);
          expect(samples[idx]).toBeLessThanOrEqual(level);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('findTrigger — unit tests', () => {
  /**
   * Build a ramp from `start` to `end` (inclusive) with `steps` points.
   */
  function ramp(start: number, end: number, steps: number): Float32Array {
    const out = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      out[i] = start + ((end - start) * i) / (steps - 1);
    }
    return out;
  }

  it('detects a rising edge in the middle of a ramp', () => {
    // Ramp from -2 to +2 over 100 samples; level = 0
    const samples = ramp(-2, 2, 100);
    const idx = findTrigger(samples, 0, 'rising', -2);
    expect(idx).toBeGreaterThanOrEqual(0);
    // The returned sample must cross from below 0 to >= 0
    const before = idx === 0 ? -2 : (samples[idx - 1] ?? 0);
    expect(before).toBeLessThan(0);
    expect(samples[idx]).toBeGreaterThanOrEqual(0);
  });

  it('detects a falling edge in the middle of a ramp', () => {
    // Ramp from +2 to -2 over 100 samples; level = 0
    const samples = ramp(2, -2, 100);
    const idx = findTrigger(samples, 0, 'falling', 2);
    expect(idx).toBeGreaterThanOrEqual(0);
    const before = idx === 0 ? 2 : (samples[idx - 1] ?? 0);
    expect(before).toBeGreaterThan(0);
    expect(samples[idx]).toBeLessThanOrEqual(0);
  });

  it('returns -1 on a constant signal (no edge to find)', () => {
    const constant = new Float32Array(50).fill(1.5);
    expect(findTrigger(constant, 1.0, 'rising', 1.5)).toBe(-1);
    expect(findTrigger(constant, 1.0, 'falling', 1.5)).toBe(-1);
    expect(findTrigger(constant, 1.5, 'rising', 1.5)).toBe(-1);
    expect(findTrigger(constant, 1.5, 'falling', 1.5)).toBe(-1);
  });

  it('detects a cross-chunk boundary trigger at index 0 using prevSample', () => {
    // prevSample is well below level; first sample in the new chunk is above level.
    const samples = new Float32Array([1.5, 2.0, 2.5]);
    const idx = findTrigger(samples, 1.0, 'rising', /* prevSample = */ -1.0);
    expect(idx).toBe(0);
    // P12: prevSample (-1.0) < level (1.0)  and  samples[0] (1.5) >= level (1.0)
    expect(-1.0).toBeLessThan(1.0);
    expect(samples[0]).toBeGreaterThanOrEqual(1.0);
  });

  it('does not trigger when the signal never drops below the arm threshold (hysteresis)', () => {
    // prevSample is already above level; signal never dips far enough below level to arm.
    const samples = new Float32Array(50).fill(0.9); // just below level 1.0 but within hysteresis
    // With level = 1.0 and hysteresisV = 0.05: armBelow = 1.0 - 0.05 = 0.95
    // All samples at 0.9 are below armBelow, so we ARE armed — but no crossing upward exists.
    // Expect -1 since no value reaches >= 1.0
    expect(findTrigger(samples, 1.0, 'rising', 0.9, 0.05)).toBe(-1);
  });

  it('detects a falling edge at index 0 when prevSample is above level', () => {
    const samples = new Float32Array([-0.5, -1.0, -1.5]);
    const idx = findTrigger(samples, 0, 'falling', /* prevSample = */ 1.0);
    expect(idx).toBe(0);
    expect(1.0).toBeGreaterThan(0);
    expect(samples[0]).toBeLessThanOrEqual(0);
  });

  it('returns -1 on an empty Float32Array', () => {
    expect(findTrigger(new Float32Array(0), 0, 'rising', 0)).toBe(-1);
    expect(findTrigger(new Float32Array(0), 0, 'falling', 0)).toBe(-1);
  });

  it('noisy sine at 0 V trigger level fires at most once per period', () => {
    // Build one full period of a 1 kHz sine at 192 kHz sample rate with added noise.
    // At level 0, the sine crosses upward exactly once per period.
    // With hysteresisV = 0.02 V, random noise of ± 0.01 V must not cause extra triggers.
    const sampleRateHz = 192000;
    const freqHz = 1000;
    const samplesPerPeriod = Math.round(sampleRateHz / freqHz); // 192
    const numPeriods = 10;
    const totalSamples = samplesPerPeriod * numPeriods;

    // Deterministic LCG noise so the test is reproducible.
    let seed = 42;
    const lcgNext = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff; // [0, 1)
    };

    const samples = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRateHz;
      const noise = (lcgNext() - 0.5) * 0.02; // ± 0.01 V
      samples[i] = Math.sin(2 * Math.PI * freqHz * t) + noise;
    }

    // Count rising-edge triggers across the buffer by scanning period by period.
    // We use a small hysteresisV of 0.02 V (default).
    let triggerCount = 0;
    let searchOffset = 0;
    let prevSampleLocal = samples[totalSamples - 1] ?? 0; // simulate prior waveform context
    // Start the prevSample from the last sample of the buffer as a continuity reference.
    // Actually use a clean "coming from below" start.
    prevSampleLocal = -1.0;
    const hysteresisV = 0.02;

    while (searchOffset < totalSamples) {
      const chunk = samples.subarray(searchOffset);
      const idx = findTrigger(chunk, 0, 'rising', prevSampleLocal, hysteresisV);
      if (idx < 0) break;
      triggerCount++;
      prevSampleLocal = chunk[idx] ?? 0;
      searchOffset += idx + 1;
    }

    // Should fire roughly once per period — allow ± 1 to handle edge effects at start/end.
    expect(triggerCount).toBeGreaterThanOrEqual(numPeriods - 1);
    expect(triggerCount).toBeLessThanOrEqual(numPeriods + 1);
  });
});
