/**
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func
 */

/**
 * A postfix compose function.
 *
 * @type {<I, X>(g: Func<I, X>) => <O>(f: Func<X, O>) => Func<I, O>}
 */
const compose = g => f => x => f(g(x))

/** @type {<T>(value: T) => T} */
const identity = value => value

/** @type {<A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A) => C} */
const flip = f => b => a => f(a)(b)

/**
 * @template I,O
 * @typedef {{
 *  readonly result: Func<I, O>
 *  readonly then: <T>(g: Func<O, T>) => Fn<I, T>
 * }} Fn
 */

/** @type {<I, O>(f: (i: I) => O) => Fn<I, O>} */
const fn = result => ({
    result,
    then: g => fn(compose(result)(g))
})

module.exports = {
    /** @readonly */
    compare: require('./compare/module.f.cjs'),
    /** @readonly */
    operator: require('./operator/module.f.cjs'),
    /** @readonly */
    identity,
    /** @readonly */
    compose,
    /** @readonly */
    flip,
    /** @readonly */
    fn,
}
