/**
 * Common interface for all signal sources (SimSource, MicSource, SerialSource).
 *
 * Always call stop() on the current source before calling start() on the new one.
 */
export interface SignalSource {
  /** Human-readable name displayed in the source selector. */
  name: string;

  /** True while the source is actively producing samples. */
  isRunning: boolean;

  /**
   * Called by the source each time a new block of samples is ready.
   * ch2 is null for single-channel sources.
   */
  onSamples: (
    ch1: Float32Array,
    ch2: Float32Array | null,
    sampleRateHz: number,
  ) => void;

  /** Called when the source encounters an unrecoverable error. */
  onError: (err: Error) => void;

  /** Begin producing samples. Resolves once the source is active. */
  start(): Promise<void>;

  /** Stop producing samples and release any held resources. */
  stop(): void;
}
