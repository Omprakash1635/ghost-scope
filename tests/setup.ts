// Register vitest-canvas-mock so OffscreenCanvas and canvas.getContext
// are available in renderer tests (jsdom does not implement them).
import 'vitest-canvas-mock';
