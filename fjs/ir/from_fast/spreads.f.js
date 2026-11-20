/**
 * The FunctionalScript originals of slice 11c: untyped programs that
 * spread arrays, strings and objects into array literals, object literals
 * and the arguments of calls, and functions with rest parameters, which a
 * program inlines where it calls one and lifts where it makes one as a
 * value. Each export takes and answers values of every kind, so its type
 * here is `any`, as the lowering types it. The [host proof](./proof.mjs)
 * lowers this text as [closures.f.js](./closures.f.js) is lowered, and
 * runs it as WASM against the functions themselves on values of every
 * kind.
 *
 * @module
 */

/** @type {(_: any, ...r: readonly any[]) => any} */
const tail = (_, ...r) => r

/** @type {(a: any) => any} */
export const prepend = a => [0, ...a]

/** @type {(a: any, b: any) => any} */
export const around = (a, b) => [...a, 1, ...b]

/** @type {(s: any) => any} */
export const chars = s => [...s]

/** @type {(f: any, a: any) => any} */
export const spreadCall = (f, a) => f(...a)

/** @type {(f: any, a: any) => any} */
export const spreadMixed = (f, a) => f(1, ...a, 2)

/** @type {(o: any, p: any) => any} */
export const merged = (o, p) => ({ ...o, k: 1, ...p })

/** @type {(o: any) => any} */
export const copied = o => ({ ...o })

/** @type {(a: any) => any} */
export const nestedSpread = a => [...[...a, ...a]]

/** @type {() => (a: any, ...r: readonly any[]) => any} */
export const restLifted = () => (a, ...r) => [a, r]

/** @type {(a: any) => any} */
export const restInlined = a => {
    /** @type {(x: any, ...r: readonly any[]) => any} */
    const g = (x, ...r) => [x, r]
    return g(a, a, 3)
}

/** @type {() => any} */
export const restEmpty = () => {
    /** @type {(...r: readonly any[]) => any} */
    const g = (...r) => r
    return g()
}

/** @type {(a: any) => any} */
export const restModule = a => tail(a, 1, 2)

/** @type {(f: any) => (...r: readonly any[]) => any} */
export const forwarded = f => (...r) => f(...r)

/** @type {(a: any) => any} */
export const restCaptured = a => {
    /** @type {(...r: readonly any[]) => () => any} */
    const g = (...r) => () => [a, ...r]
    return g(a, 2)()
}
