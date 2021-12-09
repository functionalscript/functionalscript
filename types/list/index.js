/**
 * @template T
 * @typedef {|
 *  Result<T> |
 *  Concat<T> |
 *  readonly T[] |
 *  Thunk<T>
 * } List
 */

/**
 * @template T
 * @typedef {undefined | NonEmpty<T>} Result
 */

/**
 * @template T
 * @typedef {() => List<T>} Thunk
 */

/**
 * @template T
 * @typedef {{
 *  readonly concat?: undefined
 *  readonly first: T
 *  readonly tail: List<T>
 * }} NonEmpty
 */

/**
 * @template T
 * @typedef {{
 *  readonly concat: true
 *  readonly a: List<T>
 *  readonly b: List<T>
 * }} Concat
 */

/** @type {<T>(first: T) => (tail: List<T>) => NonEmpty<T>} */
const nonEmpty = first => tail => ({ first, tail })

/** @type {<T>(a: List<T>) => (b: List<T>) => Concat<T>} */
const concat = a => b => ({ concat: true, a, b })

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(i: number) => Result<T>} */
    const at = i => i < array.length ? nonEmpty(array[i])(() => at(i + 1)) : undefined
    return at(0)
}

/** @type {<T>(list: List<T>) => Result<T> | Concat<T> } */
const trampoline = list => {
    let i = list
    while (typeof i === 'function') { i = i() }
    return i instanceof Array ? fromArray(i) : i
}

/** @type {<T>(list: List<T>) => Result<T>} */
const next = list => {
    let i = list
    while (true) {
        const u = trampoline(i)
        if (u?.concat === undefined) { return u }
        let { a, b } = u
        const ua = trampoline(a)
        if (ua === undefined) {
            i = b
        } else if (ua.concat) {
            i = concat(ua.a)(concat(ua.b)(b))
        } else {
            return nonEmpty(ua.first)(concat(ua.tail)(b))
        }
    }
}

/** @type {<T>(list: List<List<T>>) => List<T>} */
const flat = list => () => {
    const result = next(list)
    if (result === undefined) { return undefined }
    const { first, tail } = result
    return concat(first)(flat(tail))
}

/** @type {<T>(list: List<T>) => Iterable<T>} */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while(true) {
            const r = next(i)
            if (r === undefined) { return }
            yield r.first
            i = r.tail
        }
    }
})

/** @type {<T>(list: List<T>) => readonly T[]} */
const toArray = list => Array.from(iterable(list))

module.exports = {
    /** @readonly */
    nonEmpty,
    /** @readonly */
    concat,
    /** @readonly */
    next,
    /** @readonly */
    flat,
    /** @readonly */
    iterable,
    /** @readonly */
    toArray,
}
