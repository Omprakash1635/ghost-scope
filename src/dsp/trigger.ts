/**
 * Trigger detection — pure functions, no DOM, no store imports.
 *
 * Uses Schmitt-trigger hysteresis to avoid false triggers on noisy signals
 * while still returning the exact sample index where the signal crosses the
 * trigger level.  The returned index satisfies Property P12:
 *
 *   findTrigger(samples, level, 'rising', prevSample) = i  =>
 *     (i === 0 ? prevSample : samples[i-1]) < level  &&  samples[i] >= level
 */

/** Default hysteresis half-width in volts (applies when no explicit value is passed). */
const DEFAULT_HYSTERESIS_V = 0.02;

/**
 * Find the first sample index where the signal crosses `level` in the
 * direction specified by `edge`.
 *
 * @param samples      Input buffer (may span multiple display widths).
 * @param level        Trigger level in the same units as the samples (volts).
 * @param edge         'rising' — low-to-high crossing; 'falling' — high-to-low.
 * @param prevSample   Last sample from the previous call, used to detect
 *                     crossings that straddle chunk boundaries.  For i = 0 the
 *                     "previous" sample is this value; for i > 0 it is
 *                     samples[i-1].
 * @param hysteresisV  Half-width of the Schmitt hysteresis band in volts.
 *                     Defaults to 0.02 V.  Pass `0.1 * voltsPerDiv` from the
 *                     render loop so the dead-band scales with the display zoom.
 * @returns            Index of the crossing sample, or -1 if none found.
 *
 * The returned index i satisfies:
 *   rising:  (i===0 ? prevSample : samples[i-1]) <  level  &&  samples[i] >= level
 *   falling: (i===0 ? prevSample : samples[i-1]) >  level  &&  samples[i] <= level
 *
 * Hysteresis arms/disarms the trigger:
 *   rising  — armed when signal drops below (level - hysteresisV)
 *   falling — armed when signal rises above (level + hysteresisV)
 * but the returned index is always the sample that crosses `level`, not the
 * arming point, so P12 holds regardless of hysteresis state.
 */
export function findTrigger(
  samples: Float32Array,
  level: number,
  edge: 'rising' | 'falling',
  prevSample: number,
  hysteresisV: number = DEFAULT_HYSTERESIS_V,
): number {
  // Clamp hysteresisV to a minimum to prevent zero-width bands.
  const halfW = Math.max(Math.abs(hysteresisV), 1e-9);
  const armBelow = level - halfW;   // rising trigger arms when signal < armBelow
  const armAbove = level + halfW;   // falling trigger arms when signal > armAbove

  // Determine initial armed state from prevSample.
  let armed: boolean;
  if (edge === 'rising') {
    armed = prevSample < armBelow;
  } else {
    armed = prevSample > armAbove;
  }

  let prev = prevSample;

  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i] ?? 0;

    if (edge === 'rising') {
      // Arm when signal drops well below level.
      if (cur < armBelow) {
        armed = true;
      }
      // Fire when armed and signal crosses level upward.
      if (armed && prev < level && cur >= level) {
        return i;
      }
    } else {
      // Arm when signal rises well above level.
      if (cur > armAbove) {
        armed = true;
      }
      // Fire when armed and signal crosses level downward.
      if (armed && prev > level && cur <= level) {
        return i;
      }
    }

    prev = cur;
  }

  return -1;
}
