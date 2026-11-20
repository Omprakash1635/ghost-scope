# Implementation Plan: Ghost Scope

## Overview

Ghost Scope is a browser-based CRT oscilloscope with SimSource (default), MicSource, SerialSource (ESP32), phosphor rendering, DSP measurements, FFT, and an AI Ghost Technician. The task order ensures a deployable app with a live SimSource trace exists after Wave 1 (Tasks 1–6).

Priorities: **P0** = must ship, **P1** = should ship, **P2** = stretch.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "description": "Project foundation — deployable after this wave",
      "tasks": ["1", "2", "3", "4", "5", "6"]
    },
    {
      "wave": 2,
      "description": "Core oscilloscope features",
      "tasks": ["7", "8", "9", "10"]
    },
    {
      "wave": 3,
      "description": "Protocol and firmware",
      "tasks": ["11", "12", "13"]
    },
    {
      "wave": 4,
      "description": "Hardware sources",
      "tasks": ["14", "15"]
    },
    {
      "wave": 5,
      "description": "AI and P1 features",
      "tasks": ["16", "17", "18"]
    },
    {
      "wave": 6,
      "description": "Polish, accessibility and tests",
      "tasks": ["19", "20", "21", "22"]
    },
    {
      "wave": 7,
      "description": "Stretch (optional)",
      "tasks": ["23"]
    }
  ],
  "dependencies": {
    "1": [],
    "2": ["1"],
    "3": ["1"],
    "4": ["1"],
    "5": ["3", "4"],
    "6": ["5"],
    "7": ["5"],
    "8": ["5"],
    "9": ["5"],
    "10": ["7", "8", "9"],
    "11": ["1"],
    "12": ["11"],
    "13": ["11"],
    "14": ["6", "12"],
    "15": ["6", "10"],
    "16": ["6", "9"],
    "17": ["6", "9"],
    "18": ["6", "9"],
    "19": ["10"],
    "20": ["10", "19"],
    "21": ["7", "8", "9", "11", "12", "17"],
    "22": ["6", "10"],
    "23": ["6", "13"]
  }
}
```

## Tasks

### Wave 1 — Project foundation (deployable after this wave)

- [x] 1. Project scaffold
  - [x] 1.1 Init Vite + React 18 + TypeScript strict; install runtime deps: `react`, `react-dom`, `zustand`, `lz-string`, `zod`, `fft.js`; install dev deps: `vite`, `typescript`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `vitest-canvas-mock`, `fast-check`, `@playwright/test`, `eslint`
  - [x] 1.2 Create `vitest.config.ts` with jsdom environment; create `tests/setup.ts` that imports and registers `vitest-canvas-mock` (so `OffscreenCanvas` and `canvas.getContext` are available in renderer tests); reference setup file in vitest config
  - [x] 1.3 Create `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`; create `eslint.config.js`; add npm scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`
  - [x] 1.4 Create directory structure: `src/sources/`, `src/protocol/`, `src/dsp/`, `src/render/`, `src/ui/`, `src/store/`, `tests/sources/`, `tests/protocol/`, `tests/dsp/`, `tests/render/`, `e2e/`, `firmware/`, `api/`, `docs/`
  - [x] 1.5 Create `vercel.json`: set `api/diagnose.ts` function with `maxDuration: 15`; add SPA rewrite `/((?!api/).*)` → `/index.html`
  - [x] 1.6 Create `README.md` with project description, local dev instructions (`npm install`, `npm run dev`), and a placeholder line `Production URL: (added in Task 6)`
  - Satisfies: R1.1 (app loads), R8 (Vercel config)
  - Dependencies: none

- [x] 2. Kiro agent hooks + dev notes
  - [x] 2.1 Create `.kiro/hooks/dsp-test.hook`: on save of any file matching `src/dsp/**` or `src/protocol/**`, resolve the corresponding test file path (`tests/<subpath>.test.ts`) and run `npx vitest run <testFile>` — if the test file does not exist yet, skip silently
  - [x] 2.2 Create `.kiro/hooks/ui-accessibility.hook`: on save of any file matching `src/ui/**`, scan the saved file for JSX interactive elements (`<button`, `<input`, `<select`, `<a `) and warn if any element is missing both an `aria-label` attribute and visible text content
  - [x] 2.3 Create `.kiro/hooks/pre-commit.hook`: a manual hook (triggered on demand) that runs `npm run typecheck && npm run lint` and blocks if either fails
  - [x] 2.4 Create `docs/kiro-notes.md` with a daily-notes template: date, tasks worked on, what Kiro generated, what was manually adjusted, blockers
  - Dependencies: Task 1

- [x] 3. SignalSource interface + SimSource
  - [ ] 3.1 Define `SignalSource` interface in `src/sources/SignalSource.ts`: fields `name: string`, `isRunning: boolean`, callbacks `onSamples(ch1, ch2, sampleRateHz)` and `onError(err)`, methods `start(): Promise<void>` and `stop(): void`; source switching rule: always call `stop()` on the current source before calling `start()` on the new one
  - [ ] 3.2 Implement `SimSource` in `src/sources/SimSource.ts`: internal sample rate 192000 Hz (fixed constant `SIM_SAMPLE_RATE_HZ = 192000`); cap user-configurable frequency at **48000 Hz** (= 192000/4, ensuring ≥ 4 samples per cycle for every waveform); deliver Float32Array chunks via `onSamples` callback; implement `start()` / `stop()` / `isRunning`
  - [ ] 3.3 Implement all 10 waveform types: sine, square, triangle, saw, noise, pwm, am, fm, haunted (random glitches), i2c (fake burst pattern)
  - [ ] 3.4 Configurable parameters: `frequencyHz` (1–48000), `amplitudeV`, `offsetV`, `noiseLevel` (0–1)
  - [ ] 3.5 Unit tests in `tests/sources/SimSource.test.ts`: start/stop lifecycle, waveform shape checks, frequency cap enforcement
  - Satisfies: R1.1, R1.2
  - Dependencies: Task 1

- [x] 4. Zustand store
  - [ ] 4.1 Implement `src/store/scopeStore.ts` with the full `ScopeStore` shape:
    - Source: `activeSource` ('sim'|'mic'|'serial'), sim waveform params
    - Timebase: `timePerDivS`, `voltsPerDivCh1`, `voltsPerDivCh2`, `offsetVCh1`, `offsetVCh2`
    - Trigger: `triggerMode` ('auto'|'normal'|'single'), `triggerEdge`, `triggerLevelV`, `triggerHoldoffS`
    - Display: `ch1Visible`, `ch2Visible`, `fftVisible`, `cursorsVisible`, cursor positions
    - Render effects: `persistenceAlpha` (0–1; 0 = no decay trails = instant clear), `glowBlurPx`, `scanlinesVisible`, `vignetteVisible`, `reducedMotion`, `highContrast`
    - Runtime: `running`, `serialStatus`, `serialLinkKSps`, `singleCaptureReady`
    - Actions: `setSource`, `setRunning`, `toggleRunning`, `applySettings`
  - [ ] 4.2 `reducedMotion` defaults to `window.matchMedia('(prefers-reduced-motion: reduce)').matches`; `highContrast` defaults to `window.matchMedia('(prefers-contrast: more)').matches`
  - Satisfies: R2.5, R3.3, R3.4
  - Dependencies: Task 1

- [x] 5. Basic canvas renderer, graticule and App wiring
  - [ ] 5.1 Implement `src/render/graticule.ts`: draw 10×8 division grid, minor division ticks, axis labels with units (time/div and volts/div from store)
  - [ ] 5.2 Implement `src/render/phosphorRenderer.ts` (basic version): `requestAnimationFrame` loop running outside React; clear canvas; draw trace as a bright line; call graticule; expose `renderFrame(frame, settings)` and `startLoop()` / `stopLoop()`
  - [ ] 5.3 Define `ScopeFrame` and `Measurement` TypeScript interfaces in `src/sources/types.ts`
  - [ ] 5.4 Wire `App.tsx`: on mount, start SimSource and begin the rAF loop; feed samples through a minimal DSP stub (no trigger alignment yet — just copy the latest window of samples into ch1); connect store to renderer settings
  - [ ] 5.5 Add minimal React controls: source selector (Sim only for now), Run/Stop button that also responds to the Space key
  - [ ] 5.6 Verify: app loads in < 2 s, shows a moving sine trace, no permissions requested
  - Satisfies: R1.1, R2.1, R2.5
  - Dependencies: Tasks 3, 4

- [x] 6. Deploy to Vercel
  - [x] 6.1 Connect the GitHub repository `Omprakash1635/ghost-scope` to a new Vercel project; set framework preset to Vite; confirm the production build succeeds
  - [x] 6.2 Open the production URL and verify: app loads, SimSource trace is moving, no console errors
  - [x] 6.3 Update `README.md`: replace the placeholder with the real production URL on the `Production URL:` line
  - [x] 6.4 Push to `main`; confirm Vercel redeploys automatically
  - Satisfies: R1.1 (judges can try without hardware from a URL)
  - Dependencies: Task 5

### Wave 2 — Core oscilloscope features

- [x] 7. Trigger detection
  - [x] 7.1 Implement `src/dsp/trigger.ts`: `findTrigger(samples: Float32Array, level: number, edge: 'rising'|'falling', prevSample: number): number` — scan for Schmitt-hysteresis crossing; return index or -1; store last sample as `prevSample` for cross-boundary detection
  - [x] 7.2 Implement Auto/Normal/Single mode logic in the rAF loop: Auto free-runs on timeout (~100 ms without trigger), Normal waits for trigger, Single captures once then stops and sets `singleCaptureReady = true`; implement holdoff (`triggerHoldoffS`)
  - [x] 7.3 Wire trigger to renderer: trace aligns at trigger point horizontally
  - [x] 7.4 Property-based test P12 (required) in `tests/dsp/trigger.test.ts`: for all samples with a rising trigger found at index i, assert `samples[i-1] < level && samples[i] >= level`. Use `fc.float32Array({ minLength: 2, maxLength: 1024, noNaN: true, noDefaultInfinity: true, min: -10, max: 10 })`
  - Satisfies: R2.3, R2.4
  - Dependencies: Task 5

- [x] 8. DSP measurements
  - [x] 8.1 Implement `src/dsp/measurements.ts`: `computeMeasurements(samples: Float32Array, sampleRateHz: number): Measurement`
  - [x] 8.2 Schmitt-trigger zero crossing: `mean = avg(samples)`, `high = mean + 0.1*vpp`, `low = mean - 0.1*vpp`; track state machine (above/below/unknown); collect rising and falling crossing indices
  - [x] 8.3 Compute all 8 metrics: `vmin`, `vmax`, `vpp`, `vmean`, `vrms`; `frequencyHz` = null if fewer than 2 full periods or if period stddev/mean > 0.2; `periodS` = null when freq is null; `dutyCycle` = null if fewer than 2 full periods or fewer than 80% of samples are within 15% of vpp from vmin or vmax
  - [x] 8.4 MicSource path: when `activeSource === 'mic'`, label vmin/vmax/vpp/vmean/vrms as dBFS (`20 * log10(|sample| + 1e-9)`)
  - [x] 8.5 Property-based tests (required) in `tests/dsp/measurements.test.ts`. Use `fc.float32Array({ minLength: 2, maxLength: 1024, noNaN: true, noDefaultInfinity: true, min: -10, max: 10 })` for all signal generators:
    - P8: vpp ≥ 0 for all inputs
    - P9: vrms ≥ 0 for all inputs
    - P10: constant signal (all same value) → `frequencyHz === null`
    - P11: `dutyCycle === null || (dutyCycle >= 0 && dutyCycle <= 1)` for all inputs
  - Satisfies: R4.1, R4.2
  - Dependencies: Task 5

- [x] 9. Downsampling
  - [x] 9.1 Implement `src/dsp/downsample.ts`: `downsample(input: Float32Array, targetLength: number): Float32Array` using min-max bucketing — split into `ceil(targetLength/2)` buckets; each outputs `[min, max]` in chronological order (min first if min appears before max in the bucket, else max first); if targetLength is odd, the last bucket outputs only min
  - [x] 9.2 Guarantees: `output.length === targetLength` exactly; every output value ∈ `[min(input), max(input)]`; every input sample belongs to exactly one bucket
  - [x] 9.3 Property-based tests (required) in `tests/dsp/downsample.test.ts`:
    - P6 (length): for all Float32Array inputs and `targetLength = fc.integer({ min: 1, max: input.length })`, `downsample(input, targetLength).length === targetLength`
    - P7 (bounds): for all inputs and valid targetLength, every output value ∈ `[min(input), max(input)]`
    - Use `fc.float32Array({ minLength: 2, maxLength: 1024, noNaN: true, noDefaultInfinity: true, min: -10, max: 10 })`; generate targetLength with `fc.integer({ min: 1, max: input.length })` (not a fixed value)
  - Satisfies: R6.1, R9.4
  - Dependencies: Task 5

- [ ] 10. Measurement panel UI + full phosphor CRT effects
  - [ ] 10.1 Implement `src/ui/MeasurementPanel.tsx`: display all 8 measurements with correct units (Hz, s, V or dBFS), update ≥ 4 Hz, show "—" for null values, show note "Amplitude shown as dBFS (mic source)" when activeSource is 'mic'
  - [ ] 10.2 Upgrade `src/render/phosphorRenderer.ts` to offscreen compositing: allocate three canvases once (`mainCanvas`, `traceCanvas`, `glowCanvas`); per frame: (a) clear traceCanvas and draw new trace; (b) decay pass on mainCanvas with `rgba(0,0,0,persistenceAlpha)`; (c) if not highContrast: copy traceCanvas → glowCanvas with `ctx.filter = 'blur(Npx)'` and composite onto mainCanvas with `'lighter'`; (d) draw traceCanvas onto mainCanvas with `'source-over'`; feature-detect `ctx.filter` and fall back to `shadowBlur` on the traceCanvas context if unsupported
  - [ ] 10.3 Implement reduced-motion mode: when `reducedMotion === true`, the renderer internally uses a fill alpha of 1.0 (fully opaque black each frame, leaving no decay trails); skip warm-up animation entirely; disable flicker; glow and scanlines may remain
  - [ ] 10.4 Implement high-contrast mode: disable blur pass, disable scanlines, draw trace as a sharp bright line on pure black
  - [ ] 10.5 Implement 1.5 s warm-up animation in `src/render/warmup.ts` (3 phases: 0–0.3 s scanline sweep, 0.3–0.8 s glow bloom + trace fade-in, 0.8–1.5 s brief flicker); skip entirely when `reducedMotion === true`
  - [ ] 10.6 Add render controls to the UI: persistence slider, glow intensity, scanlines toggle, vignette toggle
  - [ ] 10.7 Push to `main` → confirm Vercel redeploys with measurement panel visible
  - Satisfies: R2.1, R2.5, R3.1, R3.2, R3.3, R3.4, R4.1, R4.2
  - Dependencies: Tasks 7, 8, 9

### Wave 3 — Protocol and firmware

- [ ] 11. Binary frame protocol — encoder and CRC
  - [ ] 11.1 Define `BinaryFrame` interface in `src/protocol/frameTypes.ts`: `frameType: 0x01`, `channelCount: 1|2`, `sampleRateHz: number`, `sampleCount: number`, `samples: Uint16Array` (interleaved: ch1[0], ch2[0], ch1[1], ch2[1], …; 12-bit values 0–4095)
  - [ ] 11.2 Implement `src/protocol/crc8.ts`: CRC-8/MAXIM — poly 0x31, refin=true, refout=true, init=0x00, xorout=0x00. CRC covers the 8 header bytes + all sample bytes; does NOT cover the 2 sync bytes
  - [ ] 11.3 Implement `src/protocol/encodeFrame.ts`: `encodeFrame(frame: BinaryFrame): Uint8Array`. Frame layout: `[0xA5, 0x5A, frameType(1), channelCount(1), sampleRateHz uint32 LE(4), sampleCount uint16 LE(2), ...samples uint16 LE, crc8(1)]`. Header is exactly **8 bytes** (frameType + channelCount + sampleRateHz + sampleCount — no reserved byte). Maximum frame size: 2 + 8 + 4096×2×2 + 1 = **16395 bytes**
  - [ ] 11.4 Property-based test P1 (required) in `tests/protocol/frameParser.test.ts`: for all valid BinaryFrame values, `decode(encode(frame))` returns a frame with identical fields. Use `fc.integer({ min: 1, max: 256 })` for sampleCount (keep tests fast)
  - Satisfies: R8.4, R9.4
  - Dependencies: Task 1

- [ ] 12. Frame parser state machine
  - [ ] 12.1 Implement `src/protocol/frameParser.ts` with states: `WAIT_SYNC1 → WAIT_SYNC2 → READ_HEADER → VALIDATE_HEADER → READ_SAMPLES → CHECK_CRC`
  - [ ] 12.2 Header is **8 bytes** (matching Task 11.3): frameType(1) + channelCount(1) + sampleRateHz uint32 LE(4) + sampleCount uint16 LE(2). Validate immediately after reading all 8 bytes: `frameType === 0x01`, `channelCount ∈ {1,2}`, `sampleRateHz ∈ [1, 2_000_000]`, `sampleCount ∈ [1, 4096]`. On invalid header: resync by restarting scan from `sync_pos + 1`
  - [ ] 12.3 On CRC mismatch: resync from `sync_pos + 1`. Rolling buffer max 16395 bytes. Parser is O(n) per input byte
  - [ ] 12.4 Expose `createStreamingParser()` returning `{ feed(bytes: Uint8Array): void; getFrames(): BinaryFrame[] }` for serial streaming, and `parseBytes(bytes: Uint8Array): BinaryFrame[]` for one-shot use
  - [ ] 12.5 Property-based tests (all required) in `tests/protocol/frameParser.test.ts`:
    - P2a (completeness, clean garbage): interleave real frames with garbage arrays where every byte is in `fc.integer({ min: 0, max: 254 })` (excludes 0xA5=165); assert all original frames appear **as a subsequence** in parser output — for each original frame in order, find it at or after the previous match position in the output array
    - P2b (completeness, noisy garbage): same but garbage uses `fc.integer({ min: 0, max: 255 })`; assert all original frames still appear **as a subsequence** in order
    - P3 (corrupt CRC rejected): flip one byte in the sample area; assert the corrupted frame does not appear in parser output
    - P4 (chunk-boundary invariance): same byte stream fed in random-size chunks produces identical frames as a single feed
  - Satisfies: R9.1, R9.2, R9.3, R9.4
  - Dependencies: Task 11

- [ ] 13. ESP32 firmware
  - [ ] 13.1 Create `firmware/platformio.ini` with `[env:esp32dev]` using Arduino framework; add a second env for esp32-s3 if applicable
  - [ ] 13.2 Implement `firmware/src/main.cpp`: serial command handler for `START`, `STOP`, `RATE <hz>`; ADC sampling loop streaming binary frames at ≥ 20 kS/s on channel 1; stop within 100 ms of `STOP`; reply to `RATE` with the actual achieved rate
  - [ ] 13.3 Frame format in firmware **matches Task 11.3 exactly**: 8-byte header (frameType, channelCount, sampleRateHz uint32 LE, sampleCount uint16 LE — no reserved byte), interleaved uint16 LE samples (12-bit ADC), CRC-8/MAXIM over header + samples
  - [ ] 13.4 Default baud rate: 921600 for classic ESP32 (CH340/CP2102). For ESP32-S3 with native USB (CDC): baud rate is ignored by hardware — document this in the README
  - [ ] 13.5 Create `docs/wiring.md`: resistor-divider + DC-bias input circuit schematic, explicit warning "do not exceed 3.3 V on the ADC pin", note on ESP32-S3 USB
  - Satisfies: R8.1, R8.2, R8.3, R8.4, R8.5
  - Dependencies: Task 11

### Wave 4 — Hardware sources

- [ ] 14. SerialSource (Web Serial)
  - [ ] 14.1 Implement `src/sources/SerialSource.ts`: feature-detect `'serial' in navigator`; if absent, throw descriptive error; open port at 921600 bps; pipe incoming bytes to `createStreamingParser()`; call `onSamples` with decoded frames
  - [ ] 14.2 Handle `disconnect` event: set `serialStatus = 'lost'`, call `onError`; do not reload the page
  - [ ] 14.3 Track received frames per second; compute `serialLinkKSps = framesPerSec * samplesPerFrame / 1000`; write to store
  - [ ] 14.4 Status bar: show "Link: ~45 kS/s (1ch) / ~23 kS/s (2ch)" when connected
  - [ ] 14.5 UI: "Connect ESP32" button disabled with tooltip "Use Chrome or Edge (desktop)" when Web Serial is not supported; "Signal lost – reconnect?" banner on disconnect (no page reload)
  - [ ] 14.6 Push to `main` → Vercel redeploys
  - Satisfies: R1.3, R1.4, R1.7
  - Dependencies: Tasks 6, 12

- [ ] 15. MicSource (Web Audio)
  - [ ] 15.1 Implement `src/sources/MicSource.ts`: `getUserMedia({ audio: true })` + `AudioWorklet` processor delivering raw `Float32Array` samples; use `AudioContext.sampleRate` as `sampleRateHz`
  - [ ] 15.2 On `NotAllowedError`: show "Microphone access denied" inline message; revert `activeSource` to `'sim'`; call `stop()` on MicSource and `start()` on SimSource
  - [ ] 15.3 Measurement panel shows "dBFS" labels when mic source is active
  - [ ] 15.4 Add mic source option to source selector in React UI
  - [ ] 15.5 Enforce source-switch lifecycle in `App.tsx`: always `await oldSource.stop()` before `newSource.start()`
  - [ ] 15.6 Push to `main` → Vercel redeploys
  - Satisfies: R1.5, R1.6
  - Dependencies: Tasks 6, 10

### Wave 5 — AI + P1 features

- [ ] 16. Ghost Technician AI endpoint
  - NOTE: When api/diagnose.ts is created in this task, re-add the functions block to vercel.json with maxDuration 15. It was removed before the initial Vercel deploy because Vercel fails if a listed function file does not exist.
  - [ ] 16.1 Implement `api/diagnose.ts` as a Vercel serverless function: import `AnthropicBedrockMantle` from `@anthropic-ai/bedrock-sdk`; model default `anthropic.claude-opus-5-5` (env var `MODEL_ID`); accept `DiagnoseRequest` body; return `DiagnoseResponse` JSON
  - [ ] 16.2 Rate limiting: sliding window, 10 req/IP/hr; client IP = **first** address in `x-forwarded-for` header (not the last); return HTTP 429 when exceeded
  - [ ] 16.3 `AbortController` with 10 s timeout on the Bedrock call; on timeout or 503: call `classify()` heuristic, set `isOffline = true` in response
  - [ ] 16.4 Never store request data; never send raw full-rate samples; `DiagnoseRequest` contains only measurements + ≤ 512-point downsampled trace + settings
  - [ ] 16.5 Implement `src/dsp/classify.ts`: heuristic classifier that inspects measurements and returns a `DiagnoseResponse` with `isOffline: true`; label as "offline séance"
  - [ ] 16.6 Implement `src/ui/GhostTechnician.tsx`: "Summon the Ghost Technician" button; downsample current buffer to 512 points (using `downsample`); POST `DiagnoseRequest`; display `DiagnoseResponse` fields; show "offline séance" badge when `isOffline: true`; client-side 10 s timeout
  - [ ] 16.7 Add Vercel env vars: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MODEL_ID` (default `anthropic.claude-opus-5-5`)
  - [ ] 16.8 Push to `main` → confirm Ghost Technician panel appears in production
  - [ ] 16.9 Add the functions block for api/diagnose.ts with maxDuration 15 back to vercel.json
  - Satisfies: R6.1, R6.2, R6.3, R6.4, R6.5
  - Dependencies: Tasks 6, 9

- [ ] 17. FFT spectrum view (P1)
  - [ ] 17.1 Implement `src/dsp/fft.ts`: `computeFFT(samples, windowFn, sampleRateHz)` — zero-pad to next power of 2, radix-2 FFT (use `fft.js`), magnitude in dB for bins 0..N/2, floor at −240 dB; `labelTopPeaks(freqHz, magnitudeDb, 3)` returning top-3 local maxima
  - [ ] 17.2 Window functions: rectangular (w=1), Hann, Hamming, Blackman — exact formula per design §5.4
  - [ ] 17.3 Property-based test P13 (required) in `tests/dsp/fft.test.ts`: for all Float32Array inputs, `computeFFT(samples, 'hann', 44100).magnitudeDb.length === nextPow2(samples.length) / 2`
  - [ ] 17.4 Implement `src/ui/FFTPanel.tsx`: magnitude spectrum canvas, window function selector (rectangular/Hann/Hamming/Blackman), peak labels showing frequency (Hz) and level (dB); toggle via `fftVisible` in store
  - [ ] 17.5 Push to `main` → Vercel redeploys
  - Satisfies: R5.1, R5.2, R5.3
  - Dependencies: Tasks 6, 9

- [ ] 18. Capture, export and share (P1)
  - [ ] 18.1 PNG export: freeze current frame, `canvas.toBlob()`, trigger download as `ghost-scope-capture.png`
  - [ ] 18.2 CSV export: download `ghost-scope-capture.csv` with columns `time_s, ch1, ch2` from the frozen `ScopeFrame`
  - [ ] 18.3 Implement `src/ui/shareLink.ts`: `encodeShareLink(payload)` — downsample trace to ≤ 512 points, JSON-stringify `{ trace, settings, measurements }`, compress with `lz-string` LZ+Base64, write to `window.location.hash` as `#share=<compressed>`
  - [ ] 18.4 `decodeShareLink(fragment)`: decompress → `JSON.parse` → validate with Zod `SharePayloadSchema`; on validation failure show "Corrupted link" error toast and do NOT apply any partial state to the store
  - [ ] 18.5 On app load, check for `#share=` fragment; if present, decode and apply validated payload
  - [ ] 18.6 UI: "Capture" button (freezes display), "Export PNG" and "Export CSV" buttons, "Share" button with copy-to-clipboard feedback
  - [ ] 18.7 Push to `main` → Vercel redeploys
  - Satisfies: R7.1, R7.2
  - Dependencies: Tasks 6, 9

### Wave 6 — Polish, accessibility and tests

- [ ] 19. Cursors
  - [ ] 19.1 Implement `src/render/cursors.ts`: draw two vertical time cursors and two horizontal voltage cursors; cursors are draggable (mouse and touch)
  - [ ] 19.2 Readout panel: show `Δt`, `1/Δt` (Hz), `ΔV` updated in real time from cursor positions
  - [ ] 19.3 Wire cursor positions and `cursorsVisible` toggle to Zustand store
  - [ ] 19.4 Keyboard: select active cursor with Tab, move with arrow keys (1 pixel = 1/10 div)
  - Satisfies: R4.3
  - Dependencies: Task 10

- [ ] 20. Keyboard controls and accessibility
  - [ ] 20.1 Implement `src/ui/ControlPanel.tsx`: knobs/sliders for time/div, volts/div, trigger level, trigger mode/edge, source selector — all keyboard-operable
  - [ ] 20.2 Add ARIA roles and labels to all interactive elements: buttons, sliders, selectors, measurement panel, Ghost Technician panel
  - [ ] 20.3 Test reduced-motion compliance: when `reducedMotion === true`, the renderer internally uses a fill alpha of 1.0 (fully opaque black each frame → **no decay trails**); verify this is independent of `persistenceAlpha` in the store (the renderer overrides the fill alpha internally, it does not mutate the store value)
  - [ ] 20.4 Test high-contrast compliance: blur pass skipped, scanlines hidden, trace is a sharp bright line
  - Satisfies: R2.6, R2.7, R3.3, R3.4
  - Dependencies: Tasks 10, 19

- [ ] 21. Complete property-based test suite
  - [ ] 21.1 Ensure `tests/protocol/frameParser.test.ts` contains P1, P2a, P2b, P3, P4 exactly as specified in design §7 — completeness assertions (P2a, P2b) use subsequence matching: for each expected frame in order, find it at or after the previous match position in the output array
  - [ ] 21.2 Ensure `tests/dsp/measurements.test.ts` contains P8, P9, P10, P11 with the correct `fc.float32Array` generator
  - [ ] 21.3 Ensure `tests/dsp/downsample.test.ts` contains P6 and P7; targetLength always generated as `fc.integer({ min: 1, max: input.length })` — never a fixed value
  - [ ] 21.4 Ensure `tests/dsp/trigger.test.ts` contains P12
  - [ ] 21.5 Ensure `tests/dsp/fft.test.ts` contains P13
  - [ ] 21.6 Run `npm run test` (`vitest run`) and confirm all property tests pass with no shrunk counterexamples
  - Satisfies: R9 (parser correctness), R4 (measurement correctness)
  - Dependencies: Tasks 7, 8, 9, 11, 12, 17

- [ ] 22. Playwright e2e smoke test
  - [ ] 22.1 `e2e/smoke.test.ts`: navigate to production URL (or `localhost:5173` in CI); assert page title contains "Ghost Scope"; assert canvas is visible; assert at least one measurement value is non-zero within 3 s; assert Run/Stop button toggles the trace; assert no console errors on load
  - Satisfies: R1.1, R2.1
  - Dependencies: Tasks 6, 10

### Wave 7 — Stretch (optional)

- [ ] 23. Logic analyzer mode [optional]
  - [ ] 23.1 Firmware: add burst-capture command; sample up to 8 GPIO pins into RAM at ≥ 1 MS/s; transmit burst as binary frames when complete
  - [ ] 23.2 Browser: decode burst frames; draw digital lanes (high/low per GPIO); decode UART (configurable baud) with start/data/stop annotations
  - [ ] 23.3 Browser: decode I2C — show address, R/W bit, data bytes, ACK/NACK for each transaction
  - [ ] 23.4 UI: mode toggle (Oscilloscope / Logic Analyzer)
  - Satisfies: R10.1, R10.2
  - Dependencies: Tasks 6, 13

## Notes

- Every wave (except Wave 7) ends with a push to `main` to trigger a Vercel redeploy.
- After Wave 1 (Tasks 1–6), the production URL shows a live SimSource trace — judges can verify without hardware.
- Property tests in Tasks 7–12, 17 are marked required (no asterisk). Run `npm run test` after each wave.
- Task 23 is P2 stretch — skip if the 3 Dec deadline is at risk.
