/**
 * Draws the oscilloscope graticule: grid lines, centre axes, minor ticks, and axis labels.
 * Pure canvas drawing — no DOM queries, no React.
 */

export interface GraticuleSettings {
  timePerDivS: number;
  voltsPerDivCh1: number;
  numDivsH: number;  // 10
  numDivsV: number;  // 8
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a time-per-division value with the most readable unit.
 * Uses "µs" for microseconds, "ms" for milliseconds, "s" for seconds.
 */
export function formatTime(timePerDivS: number): string {
  if (timePerDivS >= 1) {
    return `${+timePerDivS.toPrecision(3)} s/div`;
  }
  if (timePerDivS >= 0.001) {
    return `${+(timePerDivS * 1e3).toPrecision(3)} ms/div`;
  }
  return `${+(timePerDivS * 1e6).toPrecision(3)} µs/div`;
}

/**
 * Format a volts-per-division value.
 * Uses "mV" below 1 V, "V" at or above 1 V.
 */
export function formatVolts(voltsPerDivCh1: number): string {
  if (voltsPerDivCh1 >= 1) {
    return `${+voltsPerDivCh1.toPrecision(3)} V/div`;
  }
  return `${+(voltsPerDivCh1 * 1000).toPrecision(3)} mV/div`;
}

// ---------------------------------------------------------------------------
// Main draw function
// ---------------------------------------------------------------------------

/**
 * Draw the graticule onto `ctx`. Does not clear or reset the canvas.
 */
export function drawGraticule(
  ctx: CanvasRenderingContext2D,
  settings: GraticuleSettings,
): void {
  const { timePerDivS, voltsPerDivCh1, numDivsH, numDivsV, width, height } = settings;

  const divW = width / numDivsH;   // pixels per horizontal division
  const divH = height / numDivsV;  // pixels per vertical division

  const centreX = width / 2;
  const centreY = height / 2;

  ctx.save();

  // -------------------------------------------------------------------------
  // 1. Major grid lines
  // -------------------------------------------------------------------------
  ctx.strokeStyle = 'rgba(0, 180, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  // Vertical grid lines
  for (let col = 0; col <= numDivsH; col++) {
    const x = col * divW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let row = 0; row <= numDivsV; row++) {
    const y = row * divH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // 2. Centre axes (brighter)
  // -------------------------------------------------------------------------
  ctx.strokeStyle = 'rgba(0, 220, 0, 0.6)';
  ctx.lineWidth = 1;

  // Horizontal centre axis
  ctx.beginPath();
  ctx.moveTo(0, centreY);
  ctx.lineTo(width, centreY);
  ctx.stroke();

  // Vertical centre axis
  ctx.beginPath();
  ctx.moveTo(centreX, 0);
  ctx.lineTo(centreX, height);
  ctx.stroke();

  // -------------------------------------------------------------------------
  // 3. Minor tick marks — 5 subdivisions per division
  // -------------------------------------------------------------------------
  const minorSubdivisions = 5;
  const tickLenH = 6;  // length of tick on horizontal centre line
  const tickLenV = 6;  // length of tick on vertical centre line

  ctx.strokeStyle = 'rgba(0, 180, 0, 0.2)';
  ctx.lineWidth = 1;

  // Minor ticks along horizontal centre line (varying x, fixed y = centreY)
  for (let col = 0; col <= numDivsH; col++) {
    for (let sub = 1; sub < minorSubdivisions; sub++) {
      const x = col * divW + (sub / minorSubdivisions) * divW;
      ctx.beginPath();
      ctx.moveTo(x, centreY - tickLenH / 2);
      ctx.lineTo(x, centreY + tickLenH / 2);
      ctx.stroke();
    }
  }

  // Minor ticks along vertical centre line (fixed x = centreX, varying y)
  for (let row = 0; row <= numDivsV; row++) {
    for (let sub = 1; sub < minorSubdivisions; sub++) {
      const y = row * divH + (sub / minorSubdivisions) * divH;
      ctx.beginPath();
      ctx.moveTo(centreX - tickLenV / 2, y);
      ctx.lineTo(centreX + tickLenV / 2, y);
      ctx.stroke();
    }
  }

  // -------------------------------------------------------------------------
  // 4. Axis labels
  // -------------------------------------------------------------------------
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(0, 220, 0, 0.8)';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';

  // Time/div — bottom-left
  ctx.fillText(formatTime(timePerDivS), 6, height - 4);

  // Volts/div — top-left
  ctx.textBaseline = 'top';
  ctx.fillText(formatVolts(voltsPerDivCh1), 6, 4);

  ctx.restore();
}
