import type { SignalSource } from './SignalSource';

/** Internal sample rate for the simulator. */
export const SIM_SAMPLE_RATE_HZ = 192_000;

/** Maximum frequency the simulator will generate (Nyquist / 4). */
const MAX_FREQ_HZ = SIM_SAMPLE_RATE_HZ / 4; // 48 000 Hz

/** Samples delivered per callback (~24 callbacks/s at 192 kHz). */
const CHUNK_SIZE = 2048;

/** Interval between callbacks in milliseconds. */
const INTERVAL_MS = (CHUNK_SIZE / SIM_SAMPLE_RATE_HZ) * 1000; // ≈ 10.67 ms

export type WaveformType =
  | 'sine'
  | 'square'
  | 'triangle'
  | 'saw'
  | 'noise'
  | 'pwm'
  | 'am'
  | 'fm'
  | 'haunted'
  | 'i2c';

export interface SimSourceConfig {
  waveform?: WaveformType;
  frequencyHz?: number;
  amplitudeV?: number;
  offsetV?: number;
  noiseLevel?: number;
  /** Duty cycle for PWM waveform, 0–1. Default 0.3. */
  dutyCycle?: number;
}

// ---------------------------------------------------------------------------
// Pure waveform generators
// Each returns a value in roughly [-1, 1] before amplitude scaling.
// ---------------------------------------------------------------------------

function genSine(phase: number): number {
  return Math.sin(phase);
}

function genSquare(phase: number): number {
  return Math.sin(phase) >= 0 ? 1 : -1;
}

function genTriangle(phase: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

function genSaw(normalizedTime: number): number {
  // normalizedTime = f * t, fractional part gives 0→1 ramp
  return 2 * (normalizedTime % 1) - 1;
}

function genNoise(): number {
  return Math.random() * 2 - 1;
}

function genPwm(phase: number, dutyCycle: number): number {
  // phase in [0, 2π); duty expressed as fraction of period
  const normalised = ((phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return normalised < dutyCycle * 2 * Math.PI ? 1 : -1;
}

function genAM(phase: number, modPhase: number): number {
  // Carrier with slow (5 Hz) sine amplitude modulation, depth 50%
  const modulation = 1 + 0.5 * Math.sin(modPhase);
  return modulation * Math.sin(phase);
}

function genFM(carrierPhaseAccum: number): number {
  // The caller pre-computes the phase with ±20% deviation
  return Math.sin(carrierPhaseAccum);
}

/** Glitch state kept between chunks so glitches can persist briefly. */
interface HauntedState {
  glitchCountdown: number;
  phaseOffset: number;
  dropout: boolean;
}

function genHaunted(
  phase: number,
  state: HauntedState,
): number {
  if (state.dropout) return 0;
  return Math.sin(phase + state.phaseOffset) * (state.glitchCountdown > 0 ? 2.5 : 1);
}

/**
 * Generate one full I2C burst pattern.
 * Idle-high, START, 8 address bits (0x48), ACK, 8 data bits (0x37), ACK, STOP.
 * Returns an array of ±1 samples representing SCL-like digital levels.
 */
function buildI2CBurst(): Float32Array {
  const idleLen = 20;
  const bitLen = 8; // samples per bit

  const bits: number[] = [];

  // Helper: push N samples at a given level (1 = high, -1 = low)
  const push = (level: number, count: number) => {
    for (let i = 0; i < count; i++) bits.push(level);
  };

  // Idle high
  push(1, idleLen);
  // START: SDA high→low while SCL high (approximate as level drop)
  push(-1, bitLen);

  // Transmit one byte (MSB first) with ACK
  const transmitByte = (byte: number) => {
    for (let b = 7; b >= 0; b--) {
      const level = (byte >> b) & 1 ? 1 : -1;
      push(level, bitLen);
    }
    // ACK: pulled low by receiver
    push(-1, bitLen);
  };

  transmitByte(0x48); // address
  transmitByte(0x37); // data

  // STOP: SDA low→high while SCL high
  push(1, bitLen);
  // Idle
  push(1, idleLen);

  return new Float32Array(bits);
}

const I2C_BURST = buildI2CBurst();
const I2C_BURST_LEN = I2C_BURST.length; // ≈ 200 samples

// ---------------------------------------------------------------------------
// SimSource
// ---------------------------------------------------------------------------

export class SimSource implements SignalSource {
  readonly name = 'Simulator';

  isRunning = false;

  onSamples: (
    ch1: Float32Array,
    ch2: Float32Array | null,
    sampleRateHz: number,
  ) => void = () => { /* no-op until caller sets it */ };

  onError: (err: Error) => void = () => { /* no-op until caller sets it */ };

  // Current config (private, normalised)
  private waveform: WaveformType;
  private frequencyHz: number;
  private amplitudeV: number;
  private offsetV: number;
  private noiseLevel: number;
  private dutyCycle: number;

  // Phase / time accumulators
  private phase = 0;
  private modPhase = 0;
  private fmPhaseAccum = 0;
  private i2cOffset = 0;
  private sampleIndex = 0; // absolute sample counter (for FM)

  private hauntedState: HauntedState = {
    glitchCountdown: 0,
    phaseOffset: 0,
    dropout: false,
  };

  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(config: SimSourceConfig = {}) {
    this.waveform = config.waveform ?? 'sine';
    this.frequencyHz = this.clampFreq(config.frequencyHz ?? 1000);
    this.amplitudeV = config.amplitudeV ?? 1;
    this.offsetV = config.offsetV ?? 0;
    this.noiseLevel = this.clampNoise(config.noiseLevel ?? 0);
    this.dutyCycle = config.dutyCycle ?? 0.3;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  start(): Promise<void> {
    if (this.isRunning) return Promise.resolve();
    this.isRunning = true;
    this.timerId = setInterval(() => this.tick(), INTERVAL_MS);
    return Promise.resolve();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Update configuration live without stop/start.
   * Invalid values are silently clamped.
   */
  setConfig(partial: Partial<SimSourceConfig>): void {
    if (partial.waveform !== undefined) this.waveform = partial.waveform;
    if (partial.frequencyHz !== undefined)
      this.frequencyHz = this.clampFreq(partial.frequencyHz);
    if (partial.amplitudeV !== undefined) this.amplitudeV = partial.amplitudeV;
    if (partial.offsetV !== undefined) this.offsetV = partial.offsetV;
    if (partial.noiseLevel !== undefined)
      this.noiseLevel = this.clampNoise(partial.noiseLevel);
    if (partial.dutyCycle !== undefined) this.dutyCycle = partial.dutyCycle;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private clampFreq(hz: number): number {
    return Math.max(1, Math.min(MAX_FREQ_HZ, hz));
  }

  private clampNoise(n: number): number {
    return Math.max(0, Math.min(1, n));
  }

  private tick(): void {
    const buf = new Float32Array(CHUNK_SIZE);
    const twoPi = 2 * Math.PI;
    const phaseInc = (twoPi * this.frequencyHz) / SIM_SAMPLE_RATE_HZ;
    // Modulator for AM/FM: 5 Hz
    const modPhaseInc = (twoPi * 5) / SIM_SAMPLE_RATE_HZ;

    for (let i = 0; i < CHUNK_SIZE; i++) {
      let raw: number;

      switch (this.waveform) {
        case 'sine':
          raw = genSine(this.phase);
          break;

        case 'square':
          raw = genSquare(this.phase);
          break;

        case 'triangle':
          raw = genTriangle(this.phase);
          break;

        case 'saw': {
          const ft = (this.frequencyHz * this.sampleIndex) / SIM_SAMPLE_RATE_HZ;
          raw = genSaw(ft);
          break;
        }

        case 'noise':
          raw = genNoise();
          // Skip the shared noise floor addition below for pure noise
          buf[i] = raw * this.amplitudeV + this.offsetV;
          this.phase = (this.phase + phaseInc) % twoPi;
          this.sampleIndex++;
          continue;

        case 'pwm':
          raw = genPwm(this.phase, this.dutyCycle);
          break;

        case 'am':
          raw = genAM(this.phase, this.modPhase);
          this.modPhase = (this.modPhase + modPhaseInc) % twoPi;
          break;

        case 'fm': {
          // ±20% deviation around carrier frequency
          const deviation = 0.2 * this.frequencyHz;
          const fmPhaseInc =
            (twoPi * (this.frequencyHz + deviation * Math.sin(this.modPhase))) /
            SIM_SAMPLE_RATE_HZ;
          this.fmPhaseAccum = (this.fmPhaseAccum + fmPhaseInc) % twoPi;
          raw = genFM(this.fmPhaseAccum);
          this.modPhase = (this.modPhase + modPhaseInc) % twoPi;
          break;
        }

        case 'haunted': {
          // Randomly trigger glitch events ~5% of samples
          if (this.hauntedState.glitchCountdown > 0) {
            this.hauntedState.glitchCountdown--;
          } else if (Math.random() < 0.05) {
            const roll = Math.random();
            if (roll < 0.33) {
              // Amplitude spike for a few samples
              this.hauntedState.glitchCountdown = 4 + Math.floor(Math.random() * 8);
            } else if (roll < 0.66) {
              // Phase jump
              this.hauntedState.phaseOffset = Math.random() * twoPi;
              this.hauntedState.glitchCountdown = 0;
            } else {
              // Dropout
              this.hauntedState.dropout = true;
              this.hauntedState.glitchCountdown = 2 + Math.floor(Math.random() * 6);
            }
          } else {
            this.hauntedState.dropout = false;
          }
          raw = genHaunted(this.phase, this.hauntedState);
          break;
        }

        case 'i2c': {
          // Replay the burst pattern cyclically
          const idx = this.i2cOffset % I2C_BURST_LEN;
          raw = I2C_BURST[idx] ?? 0;
          this.i2cOffset++;
          // No phase accumulation needed; skip phase update
          buf[i] =
            raw * this.amplitudeV +
            this.offsetV +
            this.noiseLevel * (Math.random() * 2 - 1);
          this.sampleIndex++;
          continue;
        }

        default:
          raw = 0;
      }

      // Add noise floor (except noise/i2c which are handled above)
      buf[i] =
        raw * this.amplitudeV +
        this.offsetV +
        this.noiseLevel * (Math.random() * 2 - 1);

      this.phase = (this.phase + phaseInc) % twoPi;
      this.sampleIndex++;
    }

    this.onSamples(buf, null, SIM_SAMPLE_RATE_HZ);
  }
}
