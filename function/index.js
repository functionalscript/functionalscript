/** 
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func 
 */

/** @type {<X, O>(f: Func<X, O>) => <I>(g: Func<I, X>) => Func<I, O>} */
const combine = f => g => x => f(g(x))

/** @type {<I, X>(g: Func<I, X>) => <O>(g: Func<X, O>) => Func<I, O>} */
// const pipe = g => f => x => f(g(x))

/** @type {<T>(value: T) => T} */
const id = value => value

module.exports = {
    /** @readonly */
    id,
    /** @readonly */
    // pipe,
    /** @readonly */
    combine,
}