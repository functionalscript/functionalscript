/**
 * The FunctionalScript originals of the fifth slice: functions that call
 * functions the module does not export, which the lowering inlines at each
 * call, typed by what the call gives, records that stay inside a function,
 * and `%`, which is L1's native row `numberRemainder`. The
 * [host proof](./proof.mjs) lowers this text over the runtime and runs it
 * as WASM against the functions themselves. Their signatures are in
 * [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

// `%`

/**
 * L1's `numberIndex`, copied: L1 calls it only from `get`, which a later
 * slice lowers. A number as an array or string index: an integer from `0`
 * to `0xffff_ffff`, `-0` read as `0`, or `-1` for any other number.
 *
 * @type {(n: number) => number}
 */
const numberIndex = n => n % 1 === 0 && n >= 0 && n <= 0xffff_ffff ? n : -1

/** @type {(n: number) => number} */
export const index = n => numberIndex(n)

/** @type {(a: number, b: number) => number} */
export const remainder = (a, b) => a % b

/** A function that the module does not export, which calls one that it exports. @type {(x: number) => number} */
const third = x => remainder(x, 3)

/** @type {(a: number) => number} */
export const mod3 = a => third(a)

// functions that the module does not export

/** @type {(x: number) => number} */
const twice = x => x + x

/** @type {(a: number, b: number) => number} */
export const sumOfTwice = (a, b) => twice(a) + twice(b + 1)

/** @type {(x: bigint) => bigint} */
const twiceInt = x => x + x

/** `twiceInt` of two ranges, each call typed by what it gives. @type {(a: bigint, b: bigint) => bigint} */
export const doubleBoth = (a, b) => twiceInt(a) - twiceInt(b)

/** A function that the module does not export, which calls another. @type {(x: number) => number} */
const quad = x => twice(twice(x))

/** @type {(x: number) => number} */
export const quadruple = x => quad(x) - x

// records

/** @type {(p: { readonly x: number, readonly y: number }, q: { readonly x: number, readonly y: number }) => { readonly x: number, readonly y: number }} */
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })

/** @type {(a: number, b: number, c: number, d: number) => number} */
export const middle = (a, b, c, d) => {
    const m = mid({ x: a, y: b }, { x: c, y: d })
    return m.x * m.y
}

/** Euclid's algorithm on floats, its state a record. @type {(a: number, b: number) => number} */
export const gcd = (a, b) => {
    let r = { x: a, y: b }
    while (r.y !== 0) {
        r = { x: r.y, y: r.x % r.y }
    }
    return r.x
}
