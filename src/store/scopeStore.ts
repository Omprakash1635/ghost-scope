import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScopeStore {
  // Source
  activeSource: 'sim' | 'mic' | 'serial';
  simWaveform: 'sine' | 'square' | 'triangle' | 'saw' | 'noise' | 'pwm' | 'am' | 'fm' | 'haunted' | 'i2c';
  simFrequencyHz: number;
  simAmplitudeV: number;
  simOffsetV: number;
  simNoiseLevel: number;

  // Timebase
  timePerDivS: number;
  voltsPerDivCh1: number;
  voltsPerDivCh2: number;
  offsetVCh1: number;
  offsetVCh2: number;

  // Trigger
  triggerMode: 'auto' | 'normal' | 'single';
  triggerEdge: 'rising' | 'falling';
  triggerLevelV: number;
  triggerHoldoffS: number;

  // Display visibility
  ch1Visible: boolean;
  ch2Visible: boolean;
  fftVisible: boolean;
  cursorsVisible: boolean;

  // Cursor positions (0–1 normalised to canvas width/height)
  cursorT1: number;
  cursorT2: number;
  cursorV1: number;
  cursorV2: number;

  // Render effects
  persistenceAlpha: number;
  glowBlurPx: number;
  scanlinesVisible: boolean;
  vignetteVisible: boolean;
  reducedMotion: boolean;
  highContrast: boolean;

  // Runtime
  running: boolean;
  serialStatus: 'disconnected' | 'connecting' | 'connected' | 'lost';
  serialLinkKSps: number;
  singleCaptureReady: boolean;

  // Actions
  setSource(source: ScopeStore['activeSource']): void;
  setRunning(running: boolean): void;
  toggleRunning(): void;
  applySettings(partial: Partial<ScopeStore>): void;
}

// ---------------------------------------------------------------------------
// Media query helpers (guarded for Vitest / SSR)
// ---------------------------------------------------------------------------

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const prefersHighContrast =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-contrast: more)').matches
    : false;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const scopeStore = create<ScopeStore>()((set) => ({
  // Source
  activeSource: 'sim',
  simWaveform: 'sine',
  simFrequencyHz: 1000,
  simAmplitudeV: 1.0,
  simOffsetV: 0,
  simNoiseLevel: 0,

  // Timebase
  timePerDivS: 0.001,
  voltsPerDivCh1: 0.5,
  voltsPerDivCh2: 0.5,
  offsetVCh1: 0,
  offsetVCh2: 0,

  // Trigger
  triggerMode: 'auto',
  triggerEdge: 'rising',
  triggerLevelV: 0,
  triggerHoldoffS: 0,

  // Display visibility
  ch1Visible: true,
  ch2Visible: false,
  fftVisible: false,
  cursorsVisible: false,

  // Cursor positions
  cursorT1: 0.25,
  cursorT2: 0.75,
  cursorV1: 0.25,
  cursorV2: 0.75,

  // Render effects
  persistenceAlpha: 0.15,
  glowBlurPx: 4,
  scanlinesVisible: true,
  vignetteVisible: true,
  reducedMotion: prefersReducedMotion,
  highContrast: prefersHighContrast,

  // Runtime
  running: true,
  serialStatus: 'disconnected',
  serialLinkKSps: 0,
  singleCaptureReady: false,

  // Actions
  setSource: (source) => set({ activeSource: source }),
  setRunning: (running) => set({ running }),
  toggleRunning: () => set((state) => ({ running: !state.running })),
  applySettings: (partial) => set(partial),
}));

/** React hook — use inside components. */
export const useScopeStore = scopeStore;
