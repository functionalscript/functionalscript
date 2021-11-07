"use strict";

/**
 * @template T
 * @typedef {T|undefined} Option
 */

/**
 * @template T
 * @typedef {() => NotEmptySequence<T>|undefined} Sequence 
 */

/**
 * @template T
 * @typedef {{ first: T, tail: Sequence<T>}} NotEmptySequence
 */

/**
 * @template T
 * @typedef {() => Continuation<T>} Continue
 */

/**
 * @template T
 * @typedef {[T]|Continue<T>} Continuation
 */ 

/** @type {(_: string) => never} */
const panic = message => { throw message }

/**
 * @template T
 * @typedef {{ 
 *  get: (_: string) => T|undefined
 *  set: (_: string) => (_: T) => Dictionary<T> 
 *  entries: () => Iterable<[string, T]>
 * }} Dictionary
 */

/**
 * @template T
 * @typedef {{
 *  [_ in string]: T
 * }} InternalMap
 */

/** @type {<T>(_: InternalMap<T>) => Dictionary<T>} */
const dictionary = internal => ({
    get: key => internal[key],
    set: key => value => dictionary({ ...internal, [key]: value }),
    entries: () => Object.entries(internal),
})

/**
 * @template T
 * @template R
 * @typedef {{
 *  merge: (_: R) => (_: T) => R
 *  value: R
 * }} Reducer
 */

/** @type {(s: string) => Reducer<string, string>} */
const join = s => ({ merge: a => i => a === '' ? i : a + s + i, value: ''})

module.exports = {

    panic,

    /** @type {(_: string) => (_: boolean) => void} */
    panic_if: message => condition => condition ? panic(message) : undefined,

    /** @type {<T>() => Dictionary<T>} */
    dictionary: () => dictionary({}),

    /** @type {<T>(_: Continuation<T>) => T} */
    trampoline: continuation => {
        while (true) {
            if (typeof continuation !== 'function') {
                return continuation[0]
            }
            continuation = continuation()
        }
    },

    join,

    /** @type {<I, X>(_: (_: I) => X) => <O>(_: (_: X) => O) => (_: I) => O} */
    pipe: g => f => x => f(g(x))
}
