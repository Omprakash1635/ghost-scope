# Ghost Scope 👻

A free oscilloscope in the browser — plug in an ESP32 or use the built-in signal simulator. Features a glowing CRT phosphor display, live measurements, FFT spectrum view, and an AI "Ghost Technician" that explains your signal.

**Production URL: https://ghost-scope.vercel.app**

---

## What it is

Ghost Scope turns a ~₹400 ESP32 into a working oscilloscope. No hardware? Open the URL, press **Summon**, and see a simulated waveform glowing in green phosphor. Microphone source lets you visualise audio without any extra hardware at all.

Built for [Kiroween 2026](https://kiroween.devpost.com/) — Resurrection category.

---

## Running locally

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

Other scripts:

| Command | Purpose |
|---|---|
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit + property tests (single run) |
| `npm run test:e2e` | Playwright smoke tests |

---

## Flashing the ESP32 firmware

Requirements: [PlatformIO](https://platformio.org/) CLI or VS Code extension.

```bash
cd firmware
pio run --target upload
```

Default environment is `esp32dev` (classic ESP32 at 921600 baud).  
For ESP32-S3 with native USB, use `pio run -e esp32s3 --target upload`.

### ⚠️ Input safety — read this first

The ESP32 ADC pin accepts **0–3.3 V only**. For AC signals or anything above 3.3 V:

- Use a **voltage divider** (two 100 kΩ resistors) to scale the signal into range.
- Add a **10 µF coupling capacitor** in series with a 100 kΩ bias resistor to ground to centre the signal at 1.65 V.

See [`docs/wiring.md`](docs/wiring.md) for the full schematic.

---

## Architecture

```
ESP32 ──USB serial──► SerialSource ┐
Microphone ─────────► MicSource    ├──► SignalSource ──► ring buffer ──► trigger ──► canvas loop
Generator ──────────► SimSource    ┘                         │                         │
                                                             ├──► measurements ──► UI panel
                                                             ├──► FFT ──────────► spectrum view
                                                             └──► 512-pt summary
                                                                        │
                                                        /api/diagnose (serverless)
                                                                        ▼
                                                             Ghost Technician panel
```

---

## Project structure

```
src/sources/     SignalSource interface + SimSource, MicSource, SerialSource
src/protocol/    Binary frame encoder/decoder (shared with firmware)
src/dsp/         Trigger, measurements, FFT, windows, downsample, classify
src/render/      Canvas rAF loop, phosphor, graticule, scanlines, cursors
src/ui/          React components
src/store/       Zustand control-settings store
api/             Vercel serverless function (Ghost Technician AI)
firmware/        PlatformIO project for ESP32
tests/           Vitest unit + fast-check property tests
e2e/             Playwright smoke tests
docs/            Wiring diagram, Kiro notes
```

---

## License

MIT — see [LICENSE](LICENSE).
