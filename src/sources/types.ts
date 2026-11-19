/**
 * Shared data types for the DSP pipeline and renderer.
 */

/** One display-ready frame, produced by the DSP pipeline or directly from a source. */
export interface ScopeFrame {
  ch1: Float32Array;
  ch2: Float32Array | null;
  sampleRateHz: number;
  /** Index within ch1 at which the trigger fired. -1 if no trigger found. */
  triggerIndexCh1: number;
}

/** All automatic measurements for one channel. */
export interface Measurement {
  vmin: number | null;
  vmax: number | null;
  vpp: number | null;
  vmean: number | null;
  vrms: number | null;
  frequencyHz: number | null;
  periodS: number | null;
  dutyCycle: number | null;
}
