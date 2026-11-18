# Tech stack and conventions

## Web app
- Vite + React 18 + TypeScript (strict mode).
- Rendering: a single `<canvas>` driven by a `requestAnimationFrame` loop that lives
  outside React state. React only renders controls. Start with Canvas 2D; move the
  trace to WebGL only if Canvas 2D cannot hold 60 fps.
- Phosphor effect: draw each frame over the previous one with a translucent fill
  (persistence/decay), plus a blur/glow pass and an optional scanline overlay.
- Signal sources implement one interface (`SignalSource`) so the scope does not care
  where samples come from:
  - `SerialSource`: Web Serial API (Chrome/Edge desktop only). Feature-detect
    `navigator.serial`; show a friendly fallback message elsewhere.
  - `MicSource`: Web Audio `getUserMedia` + `AudioWorklet` for raw samples.
  - `SimSource`: built-in generator (sine, square, triangle, saw, noise, PWM,
    AM/FM, a "haunted" glitchy signal, a fake I2C burst).
- DSP in plain TypeScript in `src/dsp/` (pure functions, no DOM): trigger detection,
  measurements, FFT (radix-2, or the `fft.js` package), window functions, downsampling.
- State: React state + a small store (Zustand) for control settings only.

## AI endpoint
- One serverless function `api/diagnose.ts` (Vercel) that receives the measurement
  summary + a downsampled trace (≤ 512 points) and returns a JSON explanation.
- Calls an LLM (e.g. through Amazon Bedrock). Keys come from environment variables only,
  never shipped to the browser. Basic rate limiting per IP.
- Offline fallback: `src/dsp/classify.ts` heuristic classifier so the app still
  explains signals when the AI is unavailable.

## Firmware
- ESP32 (classic or S3), Arduino framework via PlatformIO, in `firmware/`.
- Streams ADC samples in binary frames over USB serial (see protocol in the spec).
- Accepts simple text commands from the browser (`RATE 20000`, `START`, `STOP`).
- Input safety: the ESP32 ADC pin takes 0–3.3 V only. Document a resistor divider and
  DC-bias circuit for AC signals in the README.

## Testing
- Vitest for unit tests.
- **fast-check for property-based tests** on everything in `src/dsp/` and
  `src/protocol/` (frame parser, measurements, trigger, downsampling).
- Playwright smoke test: app loads, Sim source shows a trace, measurements appear.

## Conventions
- Pure functions for DSP and protocol code; side effects only in sources and UI.
- Units in names: `sampleRateHz`, `voltsPerDiv`, `timePerDivS`.
- No `any`. Prefer small modules over large files.
- Every user-visible number gets a unit.
