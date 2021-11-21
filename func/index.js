/** 
 * @template I
 * @template O
 * @typedef {(_: I) => O} Func 
 */

/** @type {<X, O>(f: Func<X, O>) => <I>(g: Func<I, X>) => Func<I, O>} */
const combine = f => g => x => f(g(x))

/** @type {<I, X>(g: Func<I, X>) => <O>(g: Func<X, O>) => Func<I, O>} */
const pipe = g => f => x => f(g(x))

/** @type {<T>(value: T) => T} */
const id = value => value

/**
 * @template I
 * @template O
 * @typedef {{
 *  readonly pipe: <R>(f: Func<O, R>) => Pipe<I, R>
 *  readonly call: Func<I, O>
 * }} Pipe
 */

/** @type {<I, O>(f: Func<I, O>) => Pipe<I, O>} */
const pipex = call => ({
    pipe: f => pipex(pipe(call)(f)),
    call,
}) 

module.exports = {
    /** @readonly */
    id,
    /** @readonly */
    pipe,
    /** @readonly */
    combine,
    /** @readonly */
    pipex,
}