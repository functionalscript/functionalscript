/**
 * The FunctionalScript originals of the records pass
 * ([`records`](../records/module.f.js)): untyped programs whose object
 * literals of values of `any` are read back by their keys, which the pass
 * splits into a local for each value, and programs whose objects leave
 * where they are made, or are read some other way, which stay objects.
 * Each export takes and answers values of every kind, so its type here is
 * `any`, as the lowering types it. The [host proof](./proof.mjs) lowers
 * this text as [programs.f.js](./programs.f.js) is lowered, and runs it as
 * WASM against the functions themselves on values of every kind. Each loop
 * stops after a few rounds, whatever its bound.
 *
 * @module
 */

// split

/** @type {(a: any, b: any) => any} */
export const pair = (a, b) => {
    const r = { x: a, y: b }
    return r.y
}

/** @type {(n: any) => any} */
export const counted = n => {
    const zero = n * 0
    let s = { i: zero, acc: zero }
    while (s.i < n && s.i < 4) {
        s = { i: s.i + 1, acc: s.acc + s.i }
    }
    return s.acc
}

/** @type {(n: any, b: any) => any} */
export const both = (n, b) => {
    let s = { i: n, last: b }
    while (s.i < 3) {
        s = { i: s.i + 1, last: s.i }
    }
    return s.last
}

/** @type {(a: any, b: any) => any} */
export const nested = (a, b) => {
    const r = { p: { q: a }, k: b }
    return r.p.q
}

// stays an object

/** @type {(a: any, b: any) => any} */
export const whole = (a, b) => {
    const r = { x: a, y: b }
    return r
}

/** @type {(a: any) => any} */
export const missing = a => {
    /** @type {any} */
    const r = { x: a }
    return r.y
}

/** @type {(a: any, b: any) => any} */
export const twice = (a, b) => {
    const r = { x: a, y: b }
    return [r, r]
}

/** @type {(f: any, a: any) => any} */
export const given = (f, a) => {
    const r = { x: a }
    return f(r)
}

/** @type {(c: any, a: any, b: any) => any} */
export const chosen = (c, a, b) => {
    const r = c ? { x: a } : { x: b }
    return r.x
}

/** @type {(n: any) => any} */
export const reordered = n => {
    const zero = n * 0
    let s = { i: zero, acc: zero }
    while (s.i < n && s.i < 4) {
        s = { acc: s.acc + s.i, i: s.i + 1 }
    }
    return s.acc
}

/** @type {(n: any) => any} */
export const kept = n => {
    const zero = n * 0
    /** @type {any} */
    let s = { i: zero, prev: zero }
    while (s.i < n && s.i < 3) {
        s = { i: s.i + 1, prev: s }
    }
    return s.i
}
