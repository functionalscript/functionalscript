/**
 * The FunctionalScript originals of slice 11a: untyped programs, which no
 * signature table types. Each export takes and answers values of every
 * kind, so its type here is `any`, as the lowering types it. The
 * [host proof](./proof.mjs) lowers this text over the runtime and L1, links
 * the L1 bodies that the programs reach into the same module, and runs it
 * as WASM against the functions themselves on values of every kind.
 *
 * @module
 */

/** @type {(x: any) => any} */
const double = x => x * 2

/** @type {(a: any, b: any, c: any) => any} */
export const sum3 = (a, b, c) => a + b + c

/** @type {(a: any, b: any) => any} */
export const mixed = (a, b) => (a - b) / 2 + 1

/** @type {(x: any) => any} */
export const twice = x => double(double(x))

/** @type {(v: any) => any} */
export const not = v => !v

/** @type {(v: any) => any} */
export const opposite = v => -v

/** @type {(v: any) => any} */
export const kind = v => typeof v

/** @type {(a: any, b: any) => any} */
export const differ = (a, b) => a !== b

/** @type {(a: any, b: any) => any} */
export const order = (a, b) => a < b ? -1 : a > b ? 1 : a <= b && a >= b ? 0 : NaN

/** @type {(x: any) => any} */
export const sign = x => {
    if (x < 0) { return -1 }
    return x === 0 ? 0 : 1
}

/** @type {(a: any, b: any) => any} */
export const either = (a, b) => a || b

/** @type {(a: any, b: any) => any} */
export const both = (a, b) => a && b

/** @type {(a: any, b: any) => any} */
export const otherwise = (a, b) => a ?? b

/** @type {(o: any) => any} */
export const size = o => o.length > 1 ? 'long' : 'short'

/** @type {(o: any) => any} */
export const first = o => o[0]

/** @type {(o: any) => any} */
export const nested = o => o.a.b

/** @type {(o: any) => any} */
export const maybe = o => o?.length

/** @type {(f: any, x: any) => any} */
export const apply = (f, x) => f(x, 2)

/** @type {(o: any) => any} */
export const method = o => o.f(1)

/** @type {(a: any) => any} */
export const pair = a => [a, a + 1]

/** @type {(a: any, b: any) => any} */
export const record = (a, b) => ({ a, b })
