// Minimal type declaration for fft.js (no official @types package).
declare module 'fft.js' {
  export default class FFT {
    constructor(size: number);
    readonly size: number;
    createComplexArray(): Float64Array;
    realTransform(out: Float64Array, input: Float64Array | Float32Array): void;
    completeSpectrum(out: Float64Array): void;
    transform(out: Float64Array, input: Float64Array): void;
    inverseTransform(out: Float64Array, input: Float64Array): void;
  }
}
