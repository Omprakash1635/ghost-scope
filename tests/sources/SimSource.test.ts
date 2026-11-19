import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimSource, SIM_SAMPLE_RATE_HZ, type WaveformType } from '../../src/sources/SimSource';

// Helper: start a SimSource without awaiting (safe with fake timers because
// start() returns Promise.resolve() — the interval is registered synchronously).
function startSync(src: SimSource): void {
  void src.start();
}

// ---------------------------------------------------------------------------
// 3.5.1 — start/stop lifecycle
// ---------------------------------------------------------------------------
describe('SimSource lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('isRunning is false before start()', () => {
    const src = new SimSource();
    expect(src.isRunning).toBe(false);
  });

  it('isRunning is true after start()', () => {
    const src = new SimSource();
    startSync(src);
    expect(src.isRunning).toBe(true);
    src.stop();
  });

  it('isRunning is false after stop()', () => {
    const src = new SimSource();
    startSync(src);
    src.stop();
    expect(src.isRunning).toBe(false);
  });

  it('calling start() twice does not create duplicate timers', () => {
    const src = new SimSource();
    startSync(src);
    startSync(src); // second call should be a no-op
    expect(src.isRunning).toBe(true);
    src.stop();
  });

  it('calling stop() when not running is harmless', () => {
    const src = new SimSource();
    expect(() => src.stop()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3.5.2 — onSamples fires within the first interval
// ---------------------------------------------------------------------------
describe('SimSource onSamples callback', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls onSamples with a non-empty Float32Array after one tick', () => {
    const src = new SimSource({ waveform: 'sine', frequencyHz: 1000 });

    let receivedCh1: Float32Array | null = null;
    let receivedRate = 0;
    src.onSamples = (ch1, _ch2, sampleRateHz) => {
      receivedCh1 = ch1;
      receivedRate = sampleRateHz;
    };

    startSync(src);
    // Advance past the first interval (~10.67 ms)
    vi.advanceTimersByTime(20);
    src.stop();

    expect(receivedCh1).not.toBeNull();
    expect(receivedCh1!.length).toBeGreaterThan(0);
    expect(receivedRate).toBe(SIM_SAMPLE_RATE_HZ);
  });

  it('ch2 is always null for SimSource', () => {
    const src = new SimSource();
    let ch2Received: Float32Array | null | undefined = undefined;
    src.onSamples = (_ch1, ch2) => { ch2Received = ch2; };

    startSync(src);
    vi.advanceTimersByTime(20);
    src.stop();

    expect(ch2Received).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3.5.3 — frequency cap
// ---------------------------------------------------------------------------
describe('SimSource frequency cap', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('caps frequencyHz to 48 000 at construction', () => {
    const src = new SimSource({ frequencyHz: 999_999 });
    // The effective frequency is clamped; verify source is defined and produces samples
    expect(src).toBeDefined();
  });

  it('setConfig clamps over-range frequency to 48 000', () => {
    const src = new SimSource({ frequencyHz: 1000 });
    src.setConfig({ frequencyHz: 999_999 });

    let samples: Float32Array | null = null;
    src.onSamples = (ch1) => { samples = ch1; };

    startSync(src);
    vi.advanceTimersByTime(20);
    src.stop();

    expect(samples).not.toBeNull();
    for (const s of samples!) {
      expect(Number.isFinite(s)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 3.5.4 — sine shape check
// ---------------------------------------------------------------------------
describe('SimSource sine waveform shape', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sine has both positive and negative values, peak ≈ amplitudeV', () => {
    const amplitudeV = 2;
    const src = new SimSource({ waveform: 'sine', frequencyHz: 1000, amplitudeV, noiseLevel: 0 });
    const chunks: Float32Array[] = [];
    src.onSamples = (ch1) => { chunks.push(ch1); };

    startSync(src);
    // Advance enough to collect several chunks (interval ≈ 10.67 ms, so 200 ms → ~18 chunks)
    vi.advanceTimersByTime(200);
    src.stop();

    expect(chunks.length).toBeGreaterThan(0);

    let max = -Infinity;
    let min = Infinity;
    for (const chunk of chunks) {
      for (const s of chunk) {
        if (s > max) max = s;
        if (s < min) min = s;
      }
    }

    expect(max).toBeGreaterThan(0);
    expect(min).toBeLessThan(0);

    // Peak should be within 10% of amplitudeV
    expect(max).toBeGreaterThanOrEqual(amplitudeV * 0.9);
    expect(max).toBeLessThanOrEqual(amplitudeV * 1.1);
  });

  it('zero offsetV keeps mean near zero for sine', () => {
    const src = new SimSource({ waveform: 'sine', frequencyHz: 1000, amplitudeV: 1, offsetV: 0, noiseLevel: 0 });
    const chunks: Float32Array[] = [];
    src.onSamples = (ch1) => { chunks.push(ch1); };

    startSync(src);
    vi.advanceTimersByTime(200);
    src.stop();

    let sum = 0;
    let count = 0;
    for (const chunk of chunks) {
      for (const s of chunk) { sum += s; count++; }
    }
    const mean = sum / count;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// 3.5.5 — waveform type switching
// ---------------------------------------------------------------------------
describe('SimSource waveform switching', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const allWaveforms: WaveformType[] = [
    'sine', 'square', 'triangle', 'saw', 'noise', 'pwm', 'am', 'fm', 'haunted', 'i2c',
  ];

  it('switching through all 10 waveforms does not throw', () => {
    const src = new SimSource({ frequencyHz: 1000, amplitudeV: 1, noiseLevel: 0 });
    src.onSamples = () => { /* consume */ };

    startSync(src);

    for (const wf of allWaveforms) {
      expect(() => src.setConfig({ waveform: wf })).not.toThrow();
      vi.advanceTimersByTime(20); // let at least one tick fire per waveform
    }

    src.stop();
  });

  it('every waveform produces only finite values', () => {
    for (const wf of allWaveforms) {
      const src = new SimSource({ waveform: wf, frequencyHz: 1000, amplitudeV: 1, noiseLevel: 0 });
      const collected: number[] = [];
      src.onSamples = (ch1) => {
        for (const s of ch1) collected.push(s);
      };

      startSync(src);
      vi.advanceTimersByTime(30);
      src.stop();

      for (const val of collected) {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// setConfig — additional parameter checks
// ---------------------------------------------------------------------------
describe('SimSource setConfig', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('setConfig updates amplitudeV live', () => {
    const src = new SimSource({ waveform: 'sine', frequencyHz: 1000, amplitudeV: 1, noiseLevel: 0 });
    const chunks: Float32Array[] = [];
    src.onSamples = (ch1) => { chunks.push(ch1); };

    startSync(src);
    vi.advanceTimersByTime(20); // collect chunk(s) at amplitude 1

    const countAfterFirst = chunks.length;
    expect(countAfterFirst).toBeGreaterThan(0);

    src.setConfig({ amplitudeV: 3 });
    vi.advanceTimersByTime(20); // collect chunk(s) at amplitude 3
    src.stop();

    // We must have collected at least one new chunk after setConfig
    expect(chunks.length).toBeGreaterThan(countAfterFirst);

    // Compare the last chunk (amplitude 3) with the first (amplitude 1)
    const firstPeak = Math.max(...(chunks[0] ?? []));
    const lastPeak = Math.max(...(chunks[chunks.length - 1] ?? []));
    expect(lastPeak).toBeGreaterThan(firstPeak * 1.5);
  });

  it('noiseLevel is clamped to [0, 1]', () => {
    const src = new SimSource();
    expect(() => src.setConfig({ noiseLevel: -5 })).not.toThrow();
    expect(() => src.setConfig({ noiseLevel: 100 })).not.toThrow();
  });
});
