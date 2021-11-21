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
 * @template R
 * @typedef {{
 *  merge: (_: R) => (_: T) => R
 *  init: R
 * }} Reduce
 */

/** @type {<I, X>(_: (_: I) => X) => <O>(_: (_: X) => O) => (_: I) => O} */
const pipe = g => f => x => f(g(x))

/** @type {<T, R>(_: (_: T) => R) => (_: T|undefined) => R|undefined} */
const optionMap = f => x => x === undefined ? undefined : f(x)

/** @type {<T>(_: T[]) => T[]} */
const uncheckTail = a => a.slice(1)

/** @type {<T>(_: T[]) => T[]} */
const uncheckHead = a => a.slice(0, -1)

/** @type {<T>(_: T[]) => T|undefined} */
const last = a => a[a.length - 1]

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

    panic,

    todo: () => panic('not implemented'),

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

    pipe,

    last,

    optionMap,

    /** @type {<T>(_: T[]) => T[]|undefined} */
    tail: a => a.length === 0 ? undefined : uncheckTail(a),

    /** @type {<T>(_: T[]) => [T, T[]]|undefined} */
    splitFirst: a => {
        /** @typedef {typeof a[0]} T*/
        /** @type {(_: T) => [T, T[]]} */
        const split = first => [first, uncheckTail(a)]
        return optionMap(split)(a[0])
    },

    /** @type {<T>(_: T[]) => T[]|undefined} */    
    head: a => a.length === 0 ? undefined : uncheckHead(a),

    /** @type {<T>(_: T[]) => [T[], T]|undefined} */
    splitLast: a => {
        /** @typedef {typeof a[0]} T*/
        /** @type {(_: T) => [T[], T]} */
        const split = x => [uncheckHead(a), x]        
        return optionMap(split)(last(a))
    },
}
