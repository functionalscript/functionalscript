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
 *  init: R
 * }} Reduce
 */

/** @type {<I, X>(_: (_: I) => X) => <O>(_: (_: X) => O) => (_: I) => O} */
const pipe = g => f => x => f(g(x))

module.exports = {

    panic,

    todo: () => panic('not implemented'),

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

    /** @type {(s: string) => Reduce<string, string>} */
    join: s => ({ merge: a => i => a === '' ? i : a + s + i, init: ''}),

    pipe,

    /** @type {Reduce<number, number>} */
    sum: { merge: a => i => a + i, init: 0 },

    /** @type {<I, X>(_: (_: I) => X) => <O>(_: Reduce<X, O>) => Reduce<I, O>} */
    map: f => ({merge, init}) => ({
        merge: pipe(merge)(pipe(f)),
        init,
    }),

    /** @type {<T>(_: T[]) => T} */
    last: a => a[a.length - 1],

    /** @type {<T, R>(_: (_: T) => R) => (_: T|undefined) => R|undefined} */
    optionMap: f => x => x === undefined ? undefined : f(x)
}
