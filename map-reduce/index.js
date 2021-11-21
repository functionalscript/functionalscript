const { pipe, id } = require('../func')

/**
 * @template I
 * @template S
 * @template O
 * @typedef {{
 *  readonly reduce: (state: S) => (value: I) => S
 *  readonly result: (state: S) => O
 *  readonly init: S
 * }} Operation
 */

/** @type {<I, T>(mapFn: (value: I) => T) => <S, O>(op: Operation<T, S, O>) => Operation<I, S, O>} */
const map = mapFn => ({ reduce, result, init}) => ({
    reduce: pipe(reduce)(pipe(mapFn)),
    result,
    init,
})

/** @type {(separator: string) => Operation<string, string|undefined, string>} */
const join = separator => ({ 
    reduce: s => i => s === undefined ? i : `${s}${separator}${i}`, 
    init: undefined,
    result: s => s === undefined ? '' : s
})

/** @type {Operation<number, number, number>} */
const sum = { 
    reduce: a => i => a + i, 
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
