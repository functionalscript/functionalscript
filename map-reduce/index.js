const { pipe, id } = require('../func')

/**
 * @template S
 * @template I
 * @typedef {(state: S) => (value: I) => S} Merge
 */

/**
 * @template I
 * @template S
 * @template O
 * @typedef {{
 *  readonly merge: Merge<S, I>
 *  readonly result: (state: S) => O
 *  readonly init: S
 * }} Operation
 */

/** @type {<I, T>(mapFn: (value: I) => T) => <S, O>(op: Operation<T, S, O>) => Operation<I, S, O>} */
const map = mapFn => ({ merge, result, init}) => ({
    merge: pipe(merge)(pipe(mapFn)),
    result,
    init,
})

/** @type {(separator: string) => Operation<string, string|undefined, string>} */
const join = separator => ({ 
    merge: s => i => s === undefined ? i : `${s}${separator}${i}`, 
    init: undefined,
    result: s => s === undefined ? '' : s
})

/** @type {Operation<number, number, number>} */
const sum = { 
    merge: a => i => a + i, 
    result: id,
    init: 0,
}

/**
 * @type {{
 *  readonly merge: (counter: number) => () => number
 *  readonly result: (counter: number) => number
 *  readonly init: number
 * }}
 */
const size = {
    merge: counter => () => counter + 1,
    init: 0,
    result: id,
}

/**
 * @template T
 * @template R
 * @typedef {(value: T) => readonly [R, ExlusiveScan<T, R>]} ExlusiveScan
 */

/** 
 * @template T
 * @typedef {readonly[number, T]} Entry
 */

/** @type {(index: number) => <T>(value: T) => readonly[Entry<T>, ExlusiveScan<T, Entry<T>>]} */
const entriesFrom = index => value => [[index, value], entriesFrom(index + 1)]

const entries = entriesFrom(0)

module.exports = {
    /** @readonly */
    map,
    /** @readonly */
    join,
    /** @readonly */
    sum,
    /** @readonly */
    size,
    /** @readonly */
    entries,
}
