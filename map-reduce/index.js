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

module.exports = {
    /** @readonly */
    map,
    /** @readonly */
    join,
    /** @readonly */
    sum,
}
