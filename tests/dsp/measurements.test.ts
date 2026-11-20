/**
 * DSP measurements tests.
 *
 * Property-based tests (required):
 *   P8:  vpp >= 0 for all inputs
 *   P9:  vrms >= 0 for all inputs
 *   P10: constant signal -> frequencyHz === null
 *   P11: dutyCycle === null || (dutyCycle >= 0 && dutyCycle <= 1) for all inputs
 *
 * Unit tests cover:
 *   - 1 kHz sine at 192 kHz sample rate measures 1000 Hz within 1%
 *   - 50% square wave gives dutyCycle close to 0.5
 *   - Sine wave gives dutyCycle === null
 *   - Constant signal gives frequencyHz === null
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeMeasurements } from '../../src/dsp/measurements';

// ---------------------------------------------------------------------------
// Arbitrary generator — matches the fast-check spec in tasks.md §8.5
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
// P8 — vpp is non-negative
// ---------------------------------------------------------------------------

describe('P8: vpp >= 0 for all inputs', () => {
  it('vpp is never negative', () => {
    fc.assert(
      fc.property(arbSignal, (samples) => {
        const m = computeMeasurements(samples, 44100);
        if (m.vpp !== null) {
          expect(m.vpp).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// P9 — vrms is non-negative
// ---------------------------------------------------------------------------

describe('P9: vrms >= 0 for all inputs', () => {
  it('vrms is never negative', () => {
    fc.assert(
      fc.property(arbSignal, (samples) => {
        const m = computeMeasurements(samples, 44100);
        if (m.vrms !== null) {
          expect(m.vrms).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// P10 — constant signal gives frequencyHz === null
// ---------------------------------------------------------------------------

describe('P10: constant signal -> frequencyHz === null', () => {
  it('a buffer filled with one constant value has no detectable frequency', () => {
    fc.assert(
      fc.property(
        fc.float({ noNaN: true, noDefaultInfinity: true, min: -10, max: 10 }),
        fc.integer({ min: 2, max: 1024 }),
        (value, length) => {
          const samples = new Float32Array(length).fill(value);
          const m = computeMeasurements(samples, 192000);
          expect(m.frequencyHz).toBeNull();
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// P11 — dutyCycle is null or in [0, 1]
// ---------------------------------------------------------------------------

describe('P11: dutyCycle === null || (dutyCycle >= 0 && dutyCycle <= 1)', () => {
  it('duty cycle is always null or a valid fraction', () => {
    fc.assert(
      fc.property(arbSignal, (samples) => {
        const m = computeMeasurements(samples, 44100);
        if (m.dutyCycle !== null) {
          expect(m.dutyCycle).toBeGreaterThanOrEqual(0);
          expect(m.dutyCycle).toBeLessThanOrEqual(1);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

/** Build a full-amplitude sine wave at the given frequency. */
function makeSine(
  freqHz: number,
  sampleRateHz: number,
  numPeriods: number,
  amplitudeV = 1.0,
): Float32Array {
  const totalSamples = Math.round((sampleRateHz / freqHz) * numPeriods);
  const out = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    out[i] = amplitudeV * Math.sin((2 * Math.PI * freqHz * i) / sampleRateHz);
  }
  return out;
}

/** Build a 50 % duty-cycle square wave at the given frequency. */
function makeSquare(
  freqHz: number,
  sampleRateHz: number,
  numPeriods: number,
  amplitudeV = 1.0,
  dutyCycleTarget = 0.5,
): Float32Array {
  const totalSamples = Math.round((sampleRateHz / freqHz) * numPeriods);
  const samplesPerPeriod = sampleRateHz / freqHz;
  const out = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const phase = (i % samplesPerPeriod) / samplesPerPeriod;
    out[i] = phase < dutyCycleTarget ? amplitudeV : -amplitudeV;
  }
  return out;
}

describe('computeMeasurements — unit tests', () => {
  it('1 kHz sine at 192 kHz sample rate measures frequency within 1% of 1000 Hz', () => {
    const samples = makeSine(1000, 192000, 10);
    const m = computeMeasurements(samples, 192000);
    expect(m.frequencyHz).not.toBeNull();
    // Within 1% of 1000 Hz
    expect(m.frequencyHz!).toBeGreaterThanOrEqual(990);
    expect(m.frequencyHz!).toBeLessThanOrEqual(1010);
  });

  it('50% square wave gives dutyCycle close to 0.5', () => {
    const samples = makeSquare(1000, 192000, 10, 1.0, 0.5);
    const m = computeMeasurements(samples, 192000);
    expect(m.dutyCycle).not.toBeNull();
    // Allow ± 5% tolerance for discretisation at the edges
    expect(m.dutyCycle!).toBeGreaterThanOrEqual(0.45);
    expect(m.dutyCycle!).toBeLessThanOrEqual(0.55);
  });

  it('sine wave gives dutyCycle === null (not digital-like)', () => {
    // A sine wave spends most of its time in the middle of its range, so the
    // "digital fraction" test (80% of samples near vmin or vmax) should fail.
    const samples = makeSine(1000, 192000, 10);
    const m = computeMeasurements(samples, 192000);
    expect(m.dutyCycle).toBeNull();
  });

  it('constant signal gives frequencyHz === null', () => {
    const samples = new Float32Array(1000).fill(2.5);
    const m = computeMeasurements(samples, 192000);
    expect(m.frequencyHz).toBeNull();
  });

  it('constant signal gives periodS === null', () => {
    const samples = new Float32Array(1000).fill(2.5);
    const m = computeMeasurements(samples, 192000);
    expect(m.periodS).toBeNull();
  });

  it('constant signal gives dutyCycle === null', () => {
    const samples = new Float32Array(1000).fill(2.5);
    const m = computeMeasurements(samples, 192000);
    expect(m.dutyCycle).toBeNull();
  });

  it('vmin <= vmean <= vmax for a sine wave', () => {
    const samples = makeSine(1000, 192000, 5);
    const m = computeMeasurements(samples, 192000);
    expect(m.vmin).not.toBeNull();
    expect(m.vmax).not.toBeNull();
    expect(m.vmean).not.toBeNull();
    expect(m.vmin!).toBeLessThanOrEqual(m.vmean!);
    expect(m.vmean!).toBeLessThanOrEqual(m.vmax!);
  });

  it('vrms of a 1 V amplitude sine is close to 1/sqrt(2)', () => {
    const samples = makeSine(1000, 192000, 20);
    const m = computeMeasurements(samples, 192000);
    expect(m.vrms).not.toBeNull();
    // 1/sqrt(2) ≈ 0.7071; allow ±1% for discretisation
    expect(m.vrms!).toBeGreaterThanOrEqual(0.70);
    expect(m.vrms!).toBeLessThanOrEqual(0.715);
  });

  it('vpp of a ±1 V square wave is close to 2 V', () => {
    const samples = makeSquare(1000, 192000, 5);
    const m = computeMeasurements(samples, 192000);
    expect(m.vpp).not.toBeNull();
    expect(m.vpp!).toBeGreaterThanOrEqual(1.98);
    expect(m.vpp!).toBeLessThanOrEqual(2.02);
  });

  it('empty buffer returns all nulls', () => {
    const m = computeMeasurements(new Float32Array(0), 192000);
    expect(m.vmin).toBeNull();
    expect(m.vmax).toBeNull();
    expect(m.vpp).toBeNull();
    expect(m.vmean).toBeNull();
    expect(m.vrms).toBeNull();
    expect(m.frequencyHz).toBeNull();
    expect(m.periodS).toBeNull();
    expect(m.dutyCycle).toBeNull();
  });
});
