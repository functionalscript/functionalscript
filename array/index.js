const option = require('../option')

/**
 * @template T
 * @typedef {readonly T[]} Array
 */

/**
 * @template T
 * @typedef {readonly [T]} Array1
 */

/** @typedef {0} Index1 */

/**
 * @template T
 * @typedef {readonly [T, T]} Array2
 */

/** @typedef {0|1} Index2 */

/**
 * @template T
 * @typedef {readonly [T, T, T]} Array3
 */

/** @typedef {0|1|2} Index3 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T]} Array4
 */

/** @typedef {0|1|2|3} Index4 */

/**
 * @template T
 * @typedef {readonly [T, T, T, T, T]} Array5
 */

/** @typedef {0|1|2|3|4} Index5 */

/** @type {<T>(_: Array<T>) => Array<T>} */
const uncheckTail = a => a.slice(1)

/** @type {<T>(_: Array<T>) => Array<T>} */
const uncheckHead = a => a.slice(0, -1)

/** @type {<T>(_: Array<T>) => T|undefined} */
const first = a => a[0]

/** @type {<T>(_: Array<T>) => T|undefined} */
const last = a => a[a.length - 1]

/** @type {<T>(_: Array<T>) => Array<T>|undefined} */
const tail = a => a.length === 0 ? undefined : uncheckTail(a)

/** @type {<T>(_: Array<T>) => readonly [T, Array<T>]|undefined} */
const splitFirst = a => {
    /** @typedef {typeof a[0]} T*/
    /** @type {(_: T) => readonly [T, Array<T>]} */
    const split = first => [first, uncheckTail(a)]
    return option.map(split)(a[0])
}

/** @type {<T>(_: Array<T>) => Array<T>|undefined} */
const head = a => a.length === 0 ? undefined : uncheckHead(a)

/** @type {<T>(_: Array<T>) => readonly [Array<T>, T]|undefined} */
const splitLast = a => {
    /** @typedef {typeof a[0]} T*/
    /** @type {(_: T) => readonly [Array<T>, T]} */
    const split = x => [uncheckHead(a), x]
    return option.map(split)(last(a))
}

module.exports = {
    /** @readnly */
    first,
    /** @readonly */
    last,
    /** @readonly */
    head,
    /** @readonly */
    tail,
    /** @readonly */
    splitFirst,
    /** @readonly */
    splitLast,
}
