/**
 * Phosphor renderer — drives the rAF loop entirely outside React.
 *
 * Call order:
 *   startLoop(canvas)   — begin the rAF loop
 *   pushFrame(frame)    — supply new sample data (can be called at any rate)
 *   stopLoop()          — cancel the rAF loop and release resources
 *
 * Settings are read from `scopeStore.getState()` on every frame, so live
 * control changes are picked up immediately.
 */

import { scopeStore } from '../store/scopeStore';
import { drawGraticule } from './graticule';
import type { ScopeFrame } from '../sources/types';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafHandle: number | null = null;
let loopRunning = false;

/** Latest frame supplied via pushFrame(). */
let latestFrame: ScopeFrame | null = null;

const NUM_DIVS_H = 10;
const NUM_DIVS_V = 8;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Start the rAF render loop. No-op if already running. */
export function startLoop(canvasEl: HTMLCanvasElement): void {
  if (loopRunning) return;

  canvas = canvasEl;
  ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  loopRunning = true;
  rafHandle = requestAnimationFrame(tick);
}

/** Stop the rAF render loop and release the canvas reference. */
export function stopLoop(): void {
  if (!loopRunning) return;
  loopRunning = false;

  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }

  canvas = null;
  ctx = null;
}

/** Supply a new frame of samples. The renderer will draw it on the next tick. */
export function pushFrame(frame: ScopeFrame): void {
  latestFrame = frame;
}

// ---------------------------------------------------------------------------
// Internal render loop
// ---------------------------------------------------------------------------

function tick(): void {
  if (!loopRunning) return;

  // Always request the next frame first so the loop resumes when running again.
  rafHandle = requestAnimationFrame(tick);

  if (!canvas || !ctx) return;

  const store = scopeStore.getState();

  if (!store.running) {
    // Paused — keep the loop alive but skip drawing.
    return;
  }

  const {
    persistenceAlpha,
    glowBlurPx,
    scanlinesVisible,
    reducedMotion,
    highContrast,
    voltsPerDivCh1,
    timePerDivS,
    offsetVCh1,
  } = store;

  const W = canvas.width;
  const H = canvas.height;

  // -------------------------------------------------------------------------
  // 1. Decay / clear pass
  // -------------------------------------------------------------------------
  if (reducedMotion) {
    // Instant clear — no persistence trail.
    ctx.fillStyle = '#000000';
  } else {
    // Translucent black fill creates the phosphor decay trail.
    ctx.fillStyle = `rgba(0, 0, 0, ${persistenceAlpha})`;
  }
  ctx.fillRect(0, 0, W, H);

  // -------------------------------------------------------------------------
  // 2. Graticule
  // -------------------------------------------------------------------------
  drawGraticule(ctx, {
    timePerDivS,
    voltsPerDivCh1,
    numDivsH: NUM_DIVS_H,
    numDivsV: NUM_DIVS_V,
    width: W,
    height: H,
  });

  // -------------------------------------------------------------------------
  // 3. Trace
  // -------------------------------------------------------------------------
  const frame = latestFrame;
  if (frame && frame.ch1.length > 1) {
    const ch1 = frame.ch1;
    const len = ch1.length;

    // Convert voltage offset to pixels.
    const offsetPixels = (offsetVCh1 / voltsPerDivCh1) * (H / NUM_DIVS_V);

    ctx.strokeStyle = highContrast ? '#ffffff' : '#39ff14';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * W;
      // Centre the trace: positive voltage goes up (subtract from midpoint)
      const y =
        H / 2 -
        ((ch1[i] ?? 0) * H) / (voltsPerDivCh1 * NUM_DIVS_V) +
        offsetPixels;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Optional glow pass (simple shadow blur on the same path)
    if (!highContrast && glowBlurPx > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
      ctx.lineWidth = 1.5 + glowBlurPx * 0.5;
      ctx.shadowBlur = glowBlurPx * 2;
      ctx.shadowColor = '#39ff14';
      ctx.stroke();
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // 4. Scanlines overlay
  // -------------------------------------------------------------------------
  if (scanlinesVisible && !highContrast) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 2);
    }
  }
}
