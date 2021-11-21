"use strict";



/** @type {<I, X>(_: (_: I) => X) => <O>(_: (_: X) => O) => (_: I) => O} */
const pipe = g => f => x => f(g(x))

/**
 * @template I
 * @typedef {{
 *  readonly i: <O>(f: (input: I) => O) => Chain<O>
 *  readonly result: () => I
 * }} Chain
 */

/** @type {<I>(value: I) => Chain<I>} */
const chain = value => ({
    i: f => chain(f(value)),
    result: () => value
})

/**
 * @template I
 * @template T
 * @typedef {{
 *  readonly x: <O>(f: (v: T) => O) => Pipe<I, O>
 *  readonly f: (input: I) => T
 * }} Pipe
 */

module.exports = {

    todo: () => { throw 'not implemented' },

    pipe,
}
