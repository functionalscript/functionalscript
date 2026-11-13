/**
 * The FunctionalScript originals of the second slice: functions of floats,
 * booleans and `bigint`s, which the [host proof](./proof.mjs) lowers from
 * this text and runs as WASM against the functions themselves. Their
 * signatures, with each `bigint`'s range, are in
 * [`testlib.f.mjs`](./testlib.f.mjs).
 *
 * @module
 */

// floats

/** @type {(a: number, b: number) => number} */
export const max = (a, b) => a < b ? b : a

/** @type {(x: number) => number} */
export const negate = x => -x

/** @type {(x: number) => number} */
export const magnitude = x => Math.abs(-x)

/** @type {(a: number, b: number) => number} */
export const hypot = (a, b) => Math.sqrt(a * a + b * b)

/** @type {(x: number, y: number, p: number, q: number) => number} */
export const distance = (x, y, p, q) => hypot(p - x, q - y)

/** @type {(a: number, b: number) => number} */
export const safeDiv = (a, b) => b === 0 ? 0 : a / b

/** @type {(x: number, k: number) => number} */
export const pow = (x, k) => k <= 0 ? 1 : x * pow(x, k - 1)

/** @type {(a: number, b: number) => number} */
export const square = (a, b) => {
    const s = a + b
    return s * s
}

/** @type {(a: number, b: number) => number} */
export const early = (a, b) => {
    if (a < 0) { return 0 }
    const c = a * b
    return c + c - a
}

/** @type {(a: number, b: number) => boolean} */
export const greater = (a, b) => a > b

/** @type {(a: number, b: number) => boolean} */
export const atLeast = (a, b) => a >= b

// integers

/** @type {(a: bigint, b: bigint) => bigint} */
export const sum = (a, b) => a + b

/** @type {(a: bigint, b: bigint) => bigint} */
export const delta = (a, b) => a - b

/** @type {(a: bigint, b: bigint) => bigint} */
export const product = (a, b) => a * b

/** @type {(x: bigint) => bigint} */
export const opposite = x => -x

/** @type {(x: bigint) => bigint} */
export const sign = x => x < 0n ? -1n : x === 0n ? 0n : 1n

/** @type {(x: bigint, lo: bigint, hi: bigint) => bigint} */
export const clamp = (x, lo, hi) => x < lo ? lo : hi < x ? hi : x

/** @type {(a: bigint, b: bigint) => boolean} */
export const same = (a, b) => a === b

/** @type {(a: bigint, b: bigint) => boolean} */
export const notEqual = (a, b) => a !== b

/** @type {(a: bigint, b: bigint) => boolean} */
export const lessU64 = (a, b) => a < b

/** @type {(a: bigint, b: bigint) => number} */
export const average = (a, b) => Number(a + b) / 2

// booleans

/** @type {(a: boolean, b: boolean) => boolean} */
export const xor = (a, b) => a ? !b : b

/** @type {(a: boolean, b: boolean) => boolean} */
export const both = (a, b) => a && b

/** @type {(a: boolean, b: boolean) => boolean} */
export const either = (a, b) => a || b

/** @type {(a: boolean, b: boolean) => boolean} */
export const sameBool = (a, b) => a === b

/** @type {(a: boolean, b: boolean) => boolean} */
export const differ = (a, b) => a !== b
