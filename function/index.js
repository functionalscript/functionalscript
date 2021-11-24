/** 
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func 
 */

/** @type {<X, O>(f: Func<X, O>) => <I>(g: Func<I, X>) => Func<I, O>} */
const combine = f => g => x => f(g(x))

/** @type {<T>(value: T) => T} */
const id = value => value

/**
 * @template T
 * @typedef {{
 *  readonly _: <R>(f: Func<T, R>) => Pipe<R>
 *  readonly result: T
 * }} Pipe<T>
 */

/** @type {<T>(result: T) => Pipe<T>} */
const pipe = result => ({
    _: f => pipe(f(result)),
    result,
})

module.exports = {
    /** @readonly */
    id,
    /** @readonly */
    pipe,
    /** @readonly */
    combine,
}