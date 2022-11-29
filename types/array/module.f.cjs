const option = require('../option/module.f.cjs')
const { map } = option

/**
 * @template T
 * @typedef {readonly[T]} Array1
 */

/** @typedef {0} Index1 */

/**
 * @template T
 * @typedef {readonly[T, T]} Array2
 */

/**
 * @template T0
 * @template T1
 * @typedef {readonly[T0, T1]} Tuple2
 */

/** @typedef {0|1} Index2 */

/**
 * @template T
 * @typedef {readonly[T, T, T]} Array3
 */

/**
 * @template T0
 * @template T1
 * @template T2
 * @typedef {readonly[T0, T1, T2]} Tuple3
 */

/** @typedef {0|1|2} Index3 */

/**
 * @template T
 * @typedef {readonly[T, T, T, T]} Array4
 */

/** @typedef {0|1|2|3} Index4 */

/**
 * @template T
 * @typedef {readonly[T, T, T, T, T]} Array5
 */

/**
 * @template T
 * @typedef {readonly[T, T, T, T, T, T, T, T]} Array8
 */

/**
 * @template T
 * @typedef {readonly[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T]} Array16
 */

/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15} Index16 */

/**
 * @template T
 * @typedef {Array1<T>| Array2<T> | Array3<T> | Array4<T> | Array5<T>} Array1_5
 */

/** @typedef {0|1|2|3|4} Index5 */

/**
 * @template T
 * @typedef {T extends Array1<infer _> ? Index1 :
 *  T extends Array2<infer _> ? Index2 :
 *  T extends Array3<infer _> ? Index3 :
 *  T extends Array4<infer _> ? Index4 :
 *  T extends Array5<infer _> ? Index5 :
 *  T extends readonly (infer _)[] ? number :
 *  never
 * } KeyOf
 */

/** @type {<T>(_: readonly T[]) => readonly T[]} */
const uncheckTail = a => a.slice(1)

/** @type {<T>(_: readonly T[]) => readonly T[]} */
const uncheckHead = a => a.slice(0, -1)

/** @type {<T>(a: T|undefined) => T|null} */
const undefinedToNull = a => a === undefined ? null : a

/** @type {<T>(_: readonly T[]) => T|null} */
const first = a => undefinedToNull(a[0])

/** @type {<T>(_: readonly T[]) => T|null} */
const last = a => undefinedToNull(a[a.length - 1])

/** @type {<T>(_: readonly T[]) => readonly T[] | null} */
const tail = a => a.length === 0 ? null : uncheckTail(a)

/** @type {<T>(_: readonly T[]) => readonly[T, readonly T[]]|null} */
const splitFirst = a => {
    /** @typedef {typeof a[0]} T*/
    /** @type {(_: T) => readonly[T, readonly T[]]} */
    const split = first => [first, uncheckTail(a)]
    return undefinedToNull(map(split)(a[0]))
}

/** @type {<T>(_: readonly T[]) => readonly T[]|null} */
const head = a => a.length === 0 ? null : uncheckHead(a)

/** @type {<T>(_: readonly T[]) => readonly[readonly T[], T]|null} */
const splitLast = a => {
    const lastA = last(a)
    if (lastA === null) { return null }
    return [uncheckHead(a), lastA]
}

/** @type {(index: number) => <T>(a: readonly T[]) => readonly[T]|null} */
const at = index => a => index < a.length ? [a[index]] : null

module.exports = {
    /** @readonly */
    at,
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
