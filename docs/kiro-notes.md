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
