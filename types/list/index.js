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
 * @typedef {Empty | NonEmpty<T>} Result
 */

/**
 * @template T
 * @typedef {() => List<T>} Thunk
 */

/** @typedef {{ readonly type: 0 }} Empty */

/**
 * @template T
 * @typedef {{
 *  readonly type: 1
 *  readonly first: T
 *  readonly tail: List<T>
 * }} NonEmpty
 */

/**
 * @template T
 * @typedef {{
 *  readonly type: 2
 *  readonly a: List<T>
 *  readonly b: List<T>
 * }} Concat
 */

/** @type {Empty} */
const empty = { type: 0 }

/** @type {<T>(first: T) => (tail: List<T>) => NonEmpty<T>} */
const nonEmpty = first => tail => ({ type: 1, first, tail })

/** @type {<T>(a: List<T>) => (b: List<T>) => Concat<T>} */
const concat = a => b => ({ type: 2, a, b })

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(i: number) => Result<T>} */
    const at = i => i < array.length ? nonEmpty(array[i])(() => at(i + 1)) : empty
    return at(0)
}

/** @type {<T>(list: List<T>) => Result<T> | Concat<T> } */
const unwrap = list => {
    let i = list
    while (typeof i === 'function') { i = i() }
    return i instanceof Array ? fromArray(i) : i
}

/** @type {<T>(list: List<T>) => Result<T>} */
const next = list => {
    let i = list
    while (true) {
        const ui = unwrap(i)
        if (ui.type !== 2) { return ui }
        const { a, b } = ui
        const ua = unwrap(a)
        if (ua.type === 1) {
            return nonEmpty(ua.first)(concat(ua.tail)(b)) 
        }
        i = ua.type === 0 ? b : concat(ua.a)(concat(ua.b)(b))
    }
}

module.exports = {
    /** @readonly */
    next,
}