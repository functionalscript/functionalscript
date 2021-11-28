/** 
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func 
 */

/** 
 * Postfix Compose function.
 *
 * @type {<I, X>(g: Func<I, X>) => <O>(f: Func<X, O>) => Func<I, O>} 
 */
const compose = g => f => x => f(g(x))

/** @type {<T>(value: T) => T} */
const identity = value => value

module.exports = {
    /** @readonly */
    identity,
    /** @readonly */
    compose,
}