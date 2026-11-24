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

/**
 * Calls itself, not last, so it is no loop: in a program it is a function
 * of the IR that the module does not export.
 *
 * @type {(x: any) => any}
 */
const depth = x => x > 0 && x < 20 ? 1 + depth(x - 1) : 0

/** @type {(x: any) => any} */
export const countDown = x => depth(x) + depth(x)

/** @type {(a: any, b: any) => any} */
export const bits = (a, b) => [a % b, a >> b, a & b]

/** @type {(a: any, b: any) => any} */
export const texts = (a, b) => `${a}:${Number(b)}`

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
export const typeKind = v => typeof v

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

/** @type {(a: any, b: any) => any} */
export const called = (a, b) => {
    // A boolean, which the lowering types as one: JavaScript throws a TypeError on the call.
    /** @type {any} */
    const c = a < b
    return c()
}

/**
 * `every` of an arrow literal, inlined into one loop over an array, and L1's call for any other receiver.
 *
 * @type {(a: any, b: any) => any}
 */
export const allBelow = (a, b) => a.every((/** @type {any} */ x, /** @type {number} */ i) => i < 3 && x !== b)

/**
 * `filter` of an arrow literal of all three parameters, inlined into the loops over an array.
 *
 * @type {(a: any, b: any) => any}
 */
export const below = (a, b) => a.filter((/** @type {any} */ x, /** @type {number} */ i, /** @type {any} */ xs) => x < b || i === xs.length - 1)
