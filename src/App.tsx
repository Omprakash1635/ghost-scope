import { useEffect, useRef, useCallback } from 'react';
import { SimSource, type WaveformType } from './sources/SimSource';
import { useScopeStore } from './store/scopeStore';
import { startLoop, stopLoop, pushFrame } from './render/phosphorRenderer';
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<SimSource | null>(null);

  const running = useScopeStore((s) => s.running);
  const toggleRunning = useScopeStore((s) => s.toggleRunning);
  const simWaveform = useScopeStore((s) => s.simWaveform);
  const applySettings = useScopeStore((s) => s.applySettings);

  // ---------------------------------------------------------------------------
  // Create the SimSource once on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const source = new SimSource({ waveform: 'sine', frequencyHz: 1000, amplitudeV: 1.0 });
    sourceRef.current = source;

    source.onSamples = (ch1: Float32Array, ch2: Float32Array | null, sampleRateHz: number) => {
      const frame: ScopeFrame = { ch1, ch2, sampleRateHz, triggerIndexCh1: -1 };
      pushFrame(frame);
    };

    source.onError = (err: Error) => {
      console.error('[SimSource]', err);
    };

    source.start().catch((err: unknown) => console.error('[SimSource.start]', err));

    return () => {
      source.stop();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Start the rAF loop once the canvas is mounted
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    // Size the canvas to its CSS pixel dimensions.
    const resize = () => {
      canvasEl.width = canvasEl.offsetWidth;
      canvasEl.height = canvasEl.offsetHeight;
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
