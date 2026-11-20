/**
 * The FunctionalScript originals of slice 11b: untyped programs that make
 * functions as values, closures, which a program returns, calls through a
 * value, passes to a function that it is given, or keeps in an array or an
 * object. Each export takes and answers values of every kind, so its type
 * here is `any`, as the lowering types it. The [host proof](./proof.mjs)
 * lowers this text as [programs.f.js](./programs.f.js) is lowered, and
 * runs it as WASM against the functions themselves on values of every
 * kind, each function that a call answers on probes of its own.
 *
 * @module
 */

/** @type {(x: any) => any} */
const double = x => x * 2

const ten = 10

/** @type {(a: any) => (b: any) => any} */
export const adder = a => b => a + b

/** @type {(f: any) => any} */
export const callTwice = f => f(f(1))

/** @type {(a: any) => any} */
export const viaCallback = a => callTwice(/** @type {(x: any) => any} */ (x => x + a))

/** @type {(f: any) => any} */
export const given = f => f(/** @type {(x: any) => any} */ (x => [x, 3]), 1)

/** @type {() => () => any} */
export const constant = () => () => 42

/** @type {(a: any, b: any) => any} */
export const pair = (a, b) => [() => a, () => b]

/** @type {(a: any) => any} */
export const methods = a => ({ get: () => a, add: /** @type {(x: any) => any} */ (x => a + x) })

/** @type {(a: any) => (b: any) => (c: any) => any} */
export const nested = a => b => c => a + b + c

/** @type {(a: any) => (x: any) => any} */
export const usesModule = a => x => double(x) + a + ten

/** @type {(a: any) => (y: any) => any} */
export const local = a => {
    /** @type {(x: any) => any} */
    const inc = x => x + a
    return y => inc(inc(y))
}

/** @type {(a: any) => any} */
export const returned = a => {
    /** @type {(x: any) => any} */
    const inc = x => x + a
    return inc
}

/** @type {(f: any) => (x: any) => any} */
export const compose = f => x => f(f(x))

/** @type {() => any} */
export const doubler = () => double

/** @type {(a: any) => any} */
export const applied = a => adder(a)(1)

/** @type {() => any} */
export const sameModule = () => doubler() === doubler()

/** @type {(a: any) => any} */
export const sameLocal = a => {
    /** @type {(x: any) => any} */
    const inc = x => x + a
    return [inc === inc, inc(1)]
}
