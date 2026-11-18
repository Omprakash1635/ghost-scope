# Project structure

```
ghost-scope/
├── .kiro/
│   ├── steering/          product.md, tech.md, structure.md
│   ├── specs/ghost-scope/ requirements.md, design.md, tasks.md
│   └── hooks/             agent hooks (created in Kiro)
├── api/
│   └── diagnose.ts        serverless AI "Ghost Technician" endpoint
├── firmware/              PlatformIO project for the ESP32
│   ├── platformio.ini
│   └── src/main.cpp
├── src/
│   ├── sources/           SignalSource interface + SerialSource, MicSource, SimSource
│   ├── protocol/          binary frame encoder/decoder (shared format with firmware)
│   ├── dsp/               trigger, measurements, fft, windows, downsample, classify
│   ├── render/            canvas loop, phosphor, graticule, scanlines, cursors
│   ├── ui/                React components: controls, knobs, panels, GhostTechnician
│   ├── store/             control settings (Zustand)
│   ├── App.tsx
│   └── main.tsx
├── tests/                 unit + property tests mirroring src/ layout
├── e2e/                   Playwright smoke tests
├── docs/                  wiring diagram, screenshots, blog draft
├── LICENSE                MIT (must be detectable by GitHub)
└── README.md
```

Rules:
- `src/dsp/` and `src/protocol/` never import from `ui/`, `render/` or the DOM.
- Each source lives in its own file and only exposes the `SignalSource` interface.
- Tests for `src/x/y.ts` live at `tests/x/y.test.ts`.
