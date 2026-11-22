// @ts-nocheck
// The typed twins of two of benchmark.programs.mjs, which benchmark.run.mjs lowers
// with `n: f64`, so they run as plain WASM with no runtime. Companion of benchmark.md.

/** @type {(n: number) => number} */
export const sumTo = n => {
    let s = { i: 0, acc: 0 }
    while (s.i < n) {
        s = { i: s.i + 1, acc: s.acc + s.i }
    }
    return s.acc
}

/** @type {(n: number) => number} */
export const fib = n => {
    let s = { i: 0, a: 0, b: 1 }
    while (s.i < n) {
        s = { i: s.i + 1, a: s.b, b: s.a + s.b }
    }
    return s.a
}
