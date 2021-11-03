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

module.exports = {
    /** @type {(_: string) => never} */
    panic: message => { throw message },
    /** @type {<T>(_: Continuation<T>) => T} */
    trampoline: continuation => {
        while (true) {
            if (typeof continuation !== 'function') {
                return continuation[0]
            }
            continuation = continuation()
        }
    },
}
