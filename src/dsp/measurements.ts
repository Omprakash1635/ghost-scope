/**
 * DSP measurements — pure functions, no DOM, no store imports.
 *
 * computeMeasurements(samples, sampleRateHz) returns a Measurement object
 * with vmin, vmax, vpp, vmean, vrms, frequencyHz, periodS, dutyCycle.
 *
 * Frequency and duty-cycle detection use a Schmitt-trigger zero-crossing
 * state machine to find stable rising and falling edges.
 */

import type { Measurement } from '../sources/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Arithmetic mean of a Float32Array. Returns 0 for empty arrays. */
function mean(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] ?? 0;
  }
  return sum / samples.length;
}

/** Sample standard deviation. Returns 0 for arrays with fewer than 2 elements. */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute all automatic measurements for a single channel.
 *
 * @param samples       Raw voltage samples (Float32Array).
 * @param sampleRateHz  Sample rate in Hz.
 * @returns             Measurement object; null fields indicate the value is
 *                      not computable from the available data.
 */
export function computeMeasurements(
  samples: Float32Array,
  sampleRateHz: number,
): Measurement {
  if (samples.length === 0) {
    return {
      vmin: null,
      vmax: null,
      vpp: null,
      vmean: null,
      vrms: null,
      frequencyHz: null,
      periodS: null,
      dutyCycle: null,
    };
  }

  // --- Amplitude metrics ---
  let vmin = Infinity;
  let vmax = -Infinity;
  let sumSq = 0;
  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    if (s < vmin) vmin = s;
    if (s > vmax) vmax = s;
    sum += s;
    sumSq += s * s;
  }

  const vmean = sum / samples.length;
  const vrms = Math.sqrt(sumSq / samples.length);
  const vpp = vmax - vmin;

  // --- Schmitt-trigger crossing detection ---
  //
  // Thresholds: 10 % of vpp above/below the mean.
  // This tolerates gentle noise while still detecting real edges.
  //
  // States: 0 = unknown/initialising, 1 = above high threshold, -1 = below low threshold.

  let frequencyHz: number | null = null;
  let periodS: number | null = null;
  let dutyCycle: number | null = null;

  // Only attempt frequency detection if vpp is large enough to be meaningful.
  if (vpp > 1e-9) {
    const high = vmean + 0.1 * vpp;
    const low = vmean - 0.1 * vpp;

    // Collect indices of rising edges (transitions from below `low` to above `high`)
    // and falling edges (transitions from above `high` to below `low`).
    const risingEdges: number[] = [];
    const fallingEdges: number[] = [];

    let state = 0; // 0 = unknown, 1 = above, -1 = below
    // Initialise state from the first sample.
    const first = samples[0] ?? 0;
    if (first >= high) {
      state = 1;
    } else if (first <= low) {
      state = -1;
    }

    for (let i = 1; i < samples.length; i++) {
      const s = samples[i] ?? 0;
      if (s >= high) {
        if (state === -1) {
          risingEdges.push(i);
        }
        state = 1;
      } else if (s <= low) {
        if (state === 1) {
          fallingEdges.push(i);
        }
        state = -1;
      }
    }

    // --- Frequency ---
    // Need at least 2 rising edges to measure one full period.
    if (risingEdges.length >= 2) {
      const periods: number[] = [];
      for (let i = 1; i < risingEdges.length; i++) {
        const p = ((risingEdges[i] ?? 0) - (risingEdges[i - 1] ?? 0)) / sampleRateHz;
        periods.push(p);
      }
      const meanPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;
      const periodStddev = stddev(periods);

      // Reject if period jitter is too high (> 20 % of mean) — indicates noise or
      // an aperiodic signal.
      if (meanPeriod > 0 && periodStddev / meanPeriod <= 0.2) {
        periodS = meanPeriod;
        frequencyHz = 1 / meanPeriod;
      }
    }

    // --- Duty cycle ---
    // Requires at least 2 rising edges to bound at least one complete high-phase.
    // Also requires the signal to be digital-like: at least 80 % of samples must
    // be within 15 % of vpp from vmin or vmax.
    if (risingEdges.length >= 2 && fallingEdges.length >= 1) {
      const threshold = 0.15 * vpp;
      let digitalLikeSamples = 0;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i] ?? 0;
        if (s - vmin <= threshold || vmax - s <= threshold) {
          digitalLikeSamples++;
        }
      }
      const digitalFraction = digitalLikeSamples / samples.length;

      if (digitalFraction >= 0.8) {
        // Measure high-time per period: from each rising edge to the next falling edge
        // that follows it, divided by the period.
        // We need at least one rising-falling-rising triplet.
        const cycleHighFractions: number[] = [];

        for (let r = 0; r + 1 < risingEdges.length; r++) {
          const rStart = risingEdges[r] ?? 0;
          const rEnd = risingEdges[r + 1] ?? 0;
          const period = rEnd - rStart; // in samples

          // Find the first falling edge after rStart and before rEnd.
          let highTime = 0;
          for (let f = 0; f < fallingEdges.length; f++) {
            const fe = fallingEdges[f] ?? 0;
            if (fe > rStart && fe < rEnd) {
              highTime = fe - rStart;
              break;
            }
          }

          if (period > 0 && highTime > 0) {
            cycleHighFractions.push(highTime / period);
          }
        }

        if (cycleHighFractions.length > 0) {
          dutyCycle =
            cycleHighFractions.reduce((a, b) => a + b, 0) / cycleHighFractions.length;
        }
      }
    }
  }

  return {
    vmin,
    vmax,
    vpp,
    vmean,
    vrms,
    frequencyHz,
    periodS,
    dutyCycle,
  };
}

/**
 * Convert a voltage-domain measurement to dBFS.
 *
 * Used when the active source is 'mic' so that amplitude metrics are expressed
 * in decibels relative to full scale rather than volts.
 *
 * @param voltageV  Voltage value to convert.
 * @returns         Level in dBFS (always <= 0).
 */
export function toDbFs(voltageV: number): number {
  return 20 * Math.log10(Math.abs(voltageV) + 1e-9);
}
