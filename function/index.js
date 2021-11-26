/** 
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func 
 */

/** @type {<X, O>(f: Func<X, O>) => <I>(g: Func<I, X>) => Func<I, O>} */
const compose = f => g => x => f(g(x))

/** @type {<T>(value: T) => T} */
const identity = value => value

module.exports = {
    /** @readonly */
    identity,
    /** @readonly */
    compose,
}