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

/**
 * @template R
 * @template T
 * @typedef {(_: R) => (_: T) => R} Merge
 */

/** @type {(_: string) => never} */
const panic = message => { throw message }

/**
 * @template T
 * @typedef {{ 
 *  get: (_: string) => T|undefined
 *  set: (_: string) => (_: T) => Map<T> 
 *  entries: () => Iterable<[string, T]>
 * }} Map
 */

/**
 * @template T
 * @typedef {{
 *  [_ in string]: T
 * }} InternalMap
 */

/** @type {<T>(_: InternalMap<T>) => Map<T>} */
const createMap = internal => ({
    get: key => internal[key],
    set: key => value => createMap({ ...internal, [key]: value }),
    entries: () => Object.entries(internal),
})

/** @type {<R, T>(_: Merge<R, T>) => (_: R) => (_: Iterable<T>) => R} */
const reduce = merge => init => iterable => {
    let result = init
    for (let i of iterable) {
        result = merge(result)(i)
    }
    return result
}

module.exports = {

    panic,

    /** @type {(_: string) => (_: boolean) => void} */
    panic_if: message => condition => condition ? panic(message) : undefined,

    /**
     * @type {<T>() => Map<T>}
     */
    createMap: () => createMap({}),

    /** @type {<T>(_: Continuation<T>) => T} */
    trampoline: continuation => {
        while (true) {
            if (typeof continuation !== 'function') {
                return continuation[0]
            }
            continuation = continuation()
        }
    },

    /** @type {<T, R>(_: (_: T) => R) => (_: Iterable<T>) => Iterable<R>} */
    map: f => iterable => ({
        *[Symbol.iterator]() {
            for (let i of iterable) {
                yield f(i)
            }
        }
    }),

    /** @type {(_: string) => (_: Iterable<string>) => string} */
    join: s => reduce(a => a === '' ? i => i : i => a + s + i)(''),
    
    /** @type {<R, T>(_: Merge<R, T>) => (_: R) => (_: Iterable<T>) => R} */
    reduce,
}
