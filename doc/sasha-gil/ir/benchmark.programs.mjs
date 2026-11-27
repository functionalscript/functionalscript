// @ts-nocheck
// The untyped programs that benchmark.run.mjs times: FunctionalScript text, which the
// lowering reads with no signature table, so every value is of `any`. Companion of
// benchmark.md. A loop whose state mixes `f64` and `any` is refused today, so each
// loop that holds a value of `any` starts its whole state from one (`n - n`).

/** @type {(n: any) => any} */
export const sumTo = n => {
    let s = { i: 0, acc: 0 }
    while (s.i < n) {
        s = { i: s.i + 1, acc: s.acc + s.i }
    }
    return s.acc
}

/** `sumTo` with its whole state of `any`. @type {(n: any) => any} */
export const sumToAny = n => {
    const zero = n - n
    let s = { i: zero, acc: zero }
    while (s.i < n) {
        s = { i: s.i + 1, acc: s.acc + s.i }
    }
    return s.acc
}

/** @type {(n: any) => any} */
export const fib = n => {
    let s = { i: 0, a: 0, b: 1 }
    while (s.i < n) {
        s = { i: s.i + 1, a: s.b, b: s.a + s.b }
    }
    return s.a
}

/** @type {(o: any, n: any) => any} */
export const readFields = (o, n) => {
    const zero = n - n
    let s = { i: zero, acc: zero }
    while (s.i < n) {
        s = { i: s.i + 1, acc: s.acc + o.x * o.y }
    }
    return s.acc
}

/** @type {(f: any, n: any) => any} */
export const callMany = (f, n) => {
    const zero = n - n
    let s = { i: zero, acc: zero }
    while (s.i < n) {
        s = { i: s.i + 1, acc: f(s.acc, s.i) }
    }
    return s.acc
}

/**
 * Short-string microbench (S4): `s` stays within v1 enabled tags
 * (`empty` / `s1x16` / `s2x16`, max length 2). Each step concats `s + s`
 * (still short when `s` is one unit) and adds both lengths. Primary wall
 * clock for short emit + linked `length`; `repeat` stays the long-path check.
 *
 * @type {(s: any, n: any) => any}
 */
export const shortOps = (s, n) => {
    const zero = n - n
    let state = { i: zero, acc: zero }
    while (state.i < n) {
        const t = s + s
        state = { i: state.i + 1, acc: state.acc + s.length + t.length }
    }
    return state.acc
}

/** @type {(n: any, e: any) => any} */
export const repeat = (n, e) => {
    const zero = n - n
    let s = { i: zero, t: e + e }
    while (s.i < n) {
        s = { i: s.i + 1, t: s.t + 'ab' }
    }
    return s.t.length
}

/** @type {(n: any, one: any) => any} */
export const bigSum = (n, one) => {
    // `n - n` is a bigint of `any`: a literal would type the loop's state as a range
    const zero = n - n
    let s = { i: zero, acc: zero }
    while (s.i < n) {
        s = { i: s.i + one, acc: s.acc + s.i * s.i }
    }
    return s.acc
}
