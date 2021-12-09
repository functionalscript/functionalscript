/**
 * @template T
 * @typedef {|
 *  Result<T> |
 *  readonly T[] |
 *  Thunk<T> |
 *  Concat<T>
 * } List
 */

/**
 * @template T
 * @typedef {Empty | ListOne<T>} Result
 */

/**
 * @template T
 * @typedef {() => List<T>} Thunk
 */

/** @typedef {{ readonly type: 'empty' }} Empty */

/**
 * @template T
 * @typedef {{
 *  readonly type: 'listOne'
 *  readonly first: T
 *  readonly tail: List<T>
 * }} ListOne
 */

/**
 * @template T
 * @typedef {{
 *  readonly type: 'concat'
 *  readonly a: List<T>
 *  readonly b: List<T>
 * }} Concat
 */

/** @type {Empty} */
const empty = { type: 'empty'}

/** @type {<T>(a: List<T>) => (b: List<T>) => Concat<T>} */
const concat = a => b => ({ type: 'concat', a, b })

/** @type {<T>(first: T) => (tail: List<T>) => ListOne<T>} */
const nonEmpty = first => tail => ({ type: 'listOne', first, tail })

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(i: number) => Result<T>} */
    const at = i => {
        if (i < array.length) { return nonEmpty(array[i])(() => at(i + 1)) }
        return empty
    }
    return at(0)
}

/** @type {<T>(list: List<T>) => Result<T> | Concat<T> } */
const unwrap = list => {
    let i = list
    while (true) {
        if (typeof i !== 'function') {
            return i instanceof Array ? fromArray(i) : i
        }
        i = i()
    }
}

/** @type {<T>(list: List<T>) => Result<T>} */
const next = list => {
    let i = list
    while (true) {
        const u = unwrap(i)
        if (u.type !== 'concat') { return u }
        const { a, b } = u
        const ua = unwrap(a)
        if (ua.type === 'listOne') {
            return nonEmpty(ua.first)(concat(ua.tail)(b)) 
        }
        i = ua.type === 'empty' ? b : concat(ua.a)(concat(ua.b)(b))
    }
}

module.exports = {

}