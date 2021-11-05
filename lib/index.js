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

module.exports = {

    panic,

    /** @type {(_: string) => (_: boolean) => void} */
    panic_if: message => condition => condition ? panic(message) : undefined,

    /** @type {<T>(_: Continuation<T>) => T} */
    trampoline: continuation => {
        while (true) {
            if (typeof continuation !== 'function') {
                return continuation[0]
            }
            continuation = continuation()
        }
    },
    
    /** @type {<R, T>(_: Merge<R, T>) => (_: R) => (_: Iterable<T>) => R} */
    reduce: merge => init => iterabe => {
        for (let i of iterabe) {
            init = merge(init)(i)
        }
        return init
    }
}
