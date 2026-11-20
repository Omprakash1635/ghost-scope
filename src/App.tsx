import { useEffect, useRef, useCallback } from 'react';
import { SimSource, type WaveformType } from './sources/SimSource';
import { useScopeStore } from './store/scopeStore';
import { startLoop, stopLoop, pushFrame } from './render/phosphorRenderer';
import { findTrigger } from './dsp/trigger';
import type { ScopeFrame } from './sources/types';

const WAVEFORM_TYPES: WaveformType[] = [
  'sine',
  'square',
  'triangle',
  'saw',
  'noise',
  'pwm',
  'am',
  'fm',
  'haunted',
  'i2c',
];

/** Number of horizontal divisions on the display. */
const NUM_DIVS_H = 10;

/**
 * Auto-trigger timeout: if no trigger fires within this many milliseconds
 * the display free-runs (Auto mode only).
 */
const AUTO_TIMEOUT_MS = 100;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<SimSource | null>(null);

  const running = useScopeStore((s) => s.running);
  const toggleRunning = useScopeStore((s) => s.toggleRunning);
  const simWaveform = useScopeStore((s) => s.simWaveform);
  const applySettings = useScopeStore((s) => s.applySettings);
  const voltsPerDivCh1 = useScopeStore((s) => s.voltsPerDivCh1);

  // ---------------------------------------------------------------------------
  // Create the SimSource once on mount; wire samples through the trigger DSP.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const source = new SimSource({ waveform: 'sine', frequencyHz: 1000, amplitudeV: 1.0 });
    sourceRef.current = source;

    // Ring buffer for accumulating incoming samples.
    // We keep twice the display window so we always have enough post-trigger samples.
    const RING_CAPACITY = 65536; // must be power of 2
    const ring = new Float32Array(RING_CAPACITY);
    let ringHead = 0;   // next write position (mod RING_CAPACITY)
    let ringFill = 0;   // total samples ever written (unbounded int)

    // Trigger state carried between chunks.
    let prevSample = 0;
    let lastTriggerTime = performance.now() - AUTO_TIMEOUT_MS; // allow immediate trigger
    let holdoffUntil = 0; // performance.now() value after which we may trigger again

    source.onSamples = (ch1: Float32Array, _ch2: Float32Array | null, sampleRateHz: number) => {
      const store = useScopeStore.getState();
      if (!store.running) return;

      // Accumulate into ring buffer.
      for (let i = 0; i < ch1.length; i++) {
        ring[ringHead] = ch1[i] ?? 0;
        ringHead = (ringHead + 1) & (RING_CAPACITY - 1);
        ringFill++;
      }

      // How many samples fit in one display window?
      const displaySamples = Math.round(store.timePerDivS * NUM_DIVS_H * sampleRateHz);
      const windowSize = Math.min(Math.max(displaySamples, 2), RING_CAPACITY >> 1);

      // Not enough data yet.
      if (ringFill < windowSize) return;

      const {
        triggerMode,
        triggerEdge,
        triggerLevelV,
        triggerHoldoffS,
        singleCaptureReady,
      } = store;

      // Single mode: once a capture has been delivered, do nothing until rearmed.
      if (triggerMode === 'single' && singleCaptureReady) return;

      // Search for a trigger crossing in the latest chunk.
      const now = performance.now();
      let triggerIndex = -1;

      if (now >= holdoffUntil) {
        const hysteresisV = 0.1 * useScopeStore.getState().voltsPerDivCh1;
        triggerIndex = findTrigger(ch1, triggerLevelV, triggerEdge, prevSample, hysteresisV);
      }

      // Update prevSample for next call.
      if (ch1.length > 0) {
        prevSample = ch1[ch1.length - 1] ?? 0;
      }

      // Decide what to render based on trigger mode.
      const shouldFreeRun =
        triggerMode === 'auto' && now - lastTriggerTime > AUTO_TIMEOUT_MS;

      if (triggerIndex < 0 && !shouldFreeRun) {
        // No trigger found and not in free-run — wait.
        return;
      }

      if (triggerIndex >= 0) {
        // Trigger fired: apply holdoff for next cycle.
        lastTriggerTime = now;
        holdoffUntil = now + triggerHoldoffS * 1000;
      }

      // Build the display window starting at the trigger point (or the
      // start of the latest chunk when free-running).
      const startInChunk = triggerIndex >= 0 ? triggerIndex : 0;

      // How many samples from startInChunk are in the current chunk?
      const samplesAfterTrigger = ch1.length - startInChunk;

      // We want `windowSize` samples total. Take what we can from the latest
      // chunk and fill the rest from the ring buffer (earlier samples).
      const displayBuf = new Float32Array(windowSize);

      if (samplesAfterTrigger >= windowSize) {
        // The whole window fits inside the latest chunk.
        displayBuf.set(ch1.subarray(startInChunk, startInChunk + windowSize));
      } else {
        // We need to reach back into the ring buffer for earlier samples
        // (pre-trigger portion) and then paste the post-trigger samples.
        const neededFromRing = windowSize - samplesAfterTrigger;

        // The ring write head is now at ringHead. The latest sample is at
        // (ringHead - 1) & mask, which corresponds to ch1[ch1.length-1].
        // The trigger sample is at (ringHead - ch1.length + startInChunk) & mask.
        const MASK = RING_CAPACITY - 1;
        const triggerPosInRing = (ringHead - ch1.length + startInChunk) & MASK;

        // Start reading `neededFromRing` samples before the trigger.
        const readStart = (triggerPosInRing - neededFromRing + RING_CAPACITY) & MASK;

        for (let i = 0; i < neededFromRing; i++) {
          displayBuf[i] = ring[(readStart + i) & MASK] ?? 0;
        }

        // Then append the post-trigger samples from the current chunk.
        for (let i = 0; i < samplesAfterTrigger; i++) {
          displayBuf[neededFromRing + i] = ch1[startInChunk + i] ?? 0;
        }
      }

      const frame: ScopeFrame = {
        ch1: displayBuf,
        ch2: null,
        sampleRateHz,
        triggerIndexCh1: triggerIndex >= 0 ? (windowSize - samplesAfterTrigger) : 0,
      };

      pushFrame(frame);

      // For Single mode, mark capture done and stop the scope.
      if (triggerMode === 'single') {
        applySettings({ singleCaptureReady: true, running: false });
      }
    };

    source.onError = (err: Error) => {
      console.error('[SimSource]', err);
    };

    source.start().catch((err: unknown) => console.error('[SimSource.start]', err));

    return () => {
      source.stop();
    };
  }, [applySettings]);

  // ---------------------------------------------------------------------------
  // Start the rAF loop once the canvas is mounted
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    // Size the backing store to CSS pixels * devicePixelRatio so the canvas
    // is sharp on HiDPI screens.  The 2D context is scaled by the same ratio
    // so all drawing code continues to work in CSS pixel coordinates.
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvasEl.offsetWidth;
      const cssH = canvasEl.offsetHeight;
      canvasEl.width = Math.round(cssW * dpr);
      canvasEl.height = Math.round(cssH * dpr);
      // Re-apply the scale transform each time the canvas is resized because
      // assigning .width/.height resets the context state.
      const context = canvasEl.getContext('2d');
      if (context) {
        context.scale(dpr, dpr);
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvasEl);

    startLoop(canvasEl);

    return () => {
      stopLoop();
      ro.disconnect();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Global Space key → toggle run/stop (ignore when focus is on input/select)
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      toggleRunning();
    },
    [toggleRunning],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ---------------------------------------------------------------------------
  // Waveform change handler
  // ---------------------------------------------------------------------------
  const handleWaveformChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const waveform = e.target.value as WaveformType;
    sourceRef.current?.setConfig({ waveform });
    applySettings({ simWaveform: waveform });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Full-viewport canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: '#000',
        }}
      />

      {/* Control bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 12px',
          background: 'rgba(0, 0, 0, 0.6)',
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#39ff14',
          userSelect: 'none',
        }}
      >
        {/* Source selector */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Source
          <select
            aria-label="Signal source"
            value="sim"
            onChange={() => { /* only Simulator available */ }}
            style={selectStyle}
          >
            <option value="sim">Simulator</option>
          </select>
        </label>

        {/* Run / Stop */}
        <button
          aria-label="Run/Stop"
          onClick={toggleRunning}
          style={buttonStyle}
        >
          {running ? '⏸ Pause' : '▶ Resume'}
        </button>

        {/* Waveform selector */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Waveform
          <select
            aria-label="Waveform type"
            value={simWaveform}
            onChange={handleWaveformChange}
            style={selectStyle}
          >
            {WAVEFORM_TYPES.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable inline styles
// ---------------------------------------------------------------------------

const selectStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#39ff14',
  border: '1px solid rgba(57, 255, 20, 0.5)',
  borderRadius: '3px',
  padding: '2px 4px',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
};

const buttonStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.8)',
  color: '#39ff14',
  border: '1px solid rgba(57, 255, 20, 0.5)',
  borderRadius: '3px',
  padding: '3px 10px',
  fontFamily: 'monospace',
  fontSize: '13px',
  cursor: 'pointer',
};
