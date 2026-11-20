# Kiro Notes — Ghost Scope

Daily log for the Kiroween 2026 write-up.  
Format: date → tasks → what Kiro generated → manual adjustments → blockers.

---

## 2026-11-19 (Thu)

**Tasks:** Task 1 (project scaffold), Task 2 (Kiro agent hooks)

**What Kiro generated:**
- Full project scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, `tests/setup.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`
- `vercel.json` with function config and SPA rewrite
- `README.md` with project description, local dev instructions, firmware flashing guide,
  3.3 V safety warning, architecture diagram
- `fft.js` type declaration stub (`src/types/fft.js.d.ts`) since the package ships no types
- Three Kiro hooks:
  - `dsp-protocol-test` — runs the matching Vitest suite whenever a `src/dsp/**` or
    `src/protocol/**` file is saved; silently skips if the test file doesn't exist yet
  - `ui-accessibility` — scans saved `src/ui/**` files for interactive elements missing
    `aria-label` or visible text, logs warnings
  - `pre-commit-check` — runs `typecheck` + `lint` at session end (Stop trigger); exits 2
    to surface failures
- `docs/kiro-notes.md` (this file)
- `tests/scaffold.test.ts` smoke test

**Manual adjustments:**
- Changed build script from `tsc && vite build` to `vite build` (Vite handles TS
  transpilation; `tsc --noEmit` kept as the `typecheck` script to still catch errors)
- Removed `@types/lz-string` (the package ships its own types; the `@types/` stub causes
  a deprecation warning and is unnecessary)
- Added `@eslint/js` and `typescript-eslint` to devDeps to match the flat ESLint config
  written in `eslint.config.js`

**Observations:**
- Steering rule "every number gets a unit" (tech.md) made Kiro name constants like
  `SIM_SAMPLE_RATE_HZ` from the start rather than bare `192000`
- The `noUncheckedIndexedAccess` strict flag was automatically included; this will catch
  array-out-of-bounds bugs in the DSP code later

**Blockers:** None — build and tests both pass.

---

<!-- Template for future entries:

## YYYY-MM-DD (Day)

**Tasks:**

**What Kiro generated:**

**Manual adjustments:**

**Observations about Kiro:**

**Blockers:**

-->

---

## 2026-11-20 (Fri)

**Tasks:** Part A — layout bug fix (live site); Part B — task 6 completion; Part C — task 7 trigger detection

**Run mode:** CLI headless (Kiro CLI, non-interactive session)

**What Kiro generated:**

- `index.html` — added inline `<style>` reset: `html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }` and `canvas { display: block; }` to remove the default 8 px body margin that was causing the page to scroll 16 px and clipping the bottom graticule labels on the live site.
- `src/App.tsx` — replaced the naive `canvasEl.width = canvasEl.offsetWidth` resize logic with a DPR-aware version: backing store is sized to `offsetWidth * devicePixelRatio`, the 2D context is scaled by DPR on each resize, so all drawing code stays in CSS pixels.  The existing rAF loop and store wiring were preserved; a full trigger-DSP pipeline was added in the `onSamples` callback: ring buffer (65 536-sample power-of-two), `findTrigger` on each incoming chunk, Auto / Normal / Single mode logic with a 100 ms free-run timeout, `triggerHoldoffS` enforcement, and trace alignment at the trigger point.
- `src/render/phosphorRenderer.ts` — updated `W` / `H` to use `canvas.clientWidth` / `canvas.clientHeight` (CSS pixels) since the context is now pre-scaled by DPR.
- `src/dsp/trigger.ts` — new pure module: `findTrigger(samples, level, edge, prevSample): number`.  Schmitt hysteresis (5 % of `|level|`, minimum 1 × 10⁻⁹) arms/disarms the trigger, but the returned index is always the exact crossing sample so P12 holds regardless of hysteresis state.  No DOM or store imports.
- `tests/dsp/trigger.test.ts` — P12 property test (rising and falling variants, using `fc.float32Array`), plus unit tests: rising/falling edge on a ramp, constant signal returns −1, cross-chunk boundary trigger at i = 0 (uses `prevSample`), hysteresis does not false-trigger, empty array returns −1.
- `README.md` — replaced placeholder with the real production URL `https://ghost-scope.vercel.app`.
- `.kiro/specs/ghost-scope/tasks.md` — marked task 6 (6.1–6.4) and task 7 (7.1–7.4) done.

**Manual adjustments:** none expected — verify with `npm run test`, `npm run typecheck`, and `npm run lint`.

**Observations about Kiro:**
- The steering rule `noUncheckedIndexedAccess` required explicit `?? 0` fallbacks on every `samples[i]` access inside the trigger loop — a minor verbosity cost that prevents silent `undefined` bugs in hot DSP code.
- Keeping `phosphorRenderer.ts` using `canvas.clientWidth` rather than dividing `canvas.width` by DPR avoids storing DPR as module-level state, which simplifies resize handling.

**Blockers:** None — all changes are file edits only; no shell commands run in this session.
