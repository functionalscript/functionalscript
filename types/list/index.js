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
 *  readonly isConcat?: undefined
 *  readonly first: T
 *  readonly tail: List<T>
 * }} NonEmpty
 */

/**
 * @template T
 * @typedef {{
 *  readonly isConcat: true
 *  readonly a: List<T>
 *  readonly b: List<T>
 * }} Concat
 */

/** @type {<T>(first: T) => (tail: List<T>) => NonEmpty<T>} */
const nonEmpty = first => tail => ({ first, tail })

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(i: number) => Result<T>} */
    const at = i => i < array.length ? nonEmpty(array[i])(() => at(i + 1)) : undefined
    return at(0)
}

/** @type {<T>(a: List<T>) => (b: List<T>) => List<T>} */
const concat = a => b => a === undefined ? b : b === undefined ? a : { isConcat: true, a, b }

/** @type {<T>(list: List<T>) => Result<T>} */
const next = list => {
    /** @type {readonly[typeof list, typeof list]} */
    let [a, b] = [list, undefined]
    while (true) {
        if (typeof a === 'function') {
            a = a()
            continue
        }

        if (a instanceof Array) {
            a = fromArray(a)
        } else if (a?.isConcat) {
            [a, b] = [a.a, concat(a.b)(b)]
            continue
        }

        if (a !== undefined) {
            const { first, tail } = a
            return { first, tail: concat(tail)(b) }
        }

        if (b === undefined) { return undefined }

        [a, b] = [b, undefined]
    }
}

/** @type {<T>(list: List<List<T>>) => List<T>} */
const flat = list => {
    if (list === undefined) { return undefined }
    return () => {
        const result = next(list)
        if (result === undefined) { return undefined }
        const { first, tail } = result
        return concat(first)(flat(tail))
    }
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
