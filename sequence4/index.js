const { todo } = require("../dev")
const { sequence } = require("../sequence")

/**
 * @template T
 * @typedef {readonly T[] | Result<T> | Thunk<T>} Sequence
 */

/**
 * @template T 
 * @typedef {FirstAndTail<T> | undefined} Result 
 */

/**
 * @template T
 * @typedef {{
 *  readonly first: T
 *  readonly tail: Sequence<T>
 * }} FirstAndTail
 */

/**
 * @template T
 * @typedef {() => Sequence<T>} Thunk
 */

/**
 * @template T
 * @typedef {readonly T[] | Result<T>} ArrayOrResult<T>
 */

/**
 * @template T
 * @typedef {Result<T> | Thunk<T>} LazyResult<T>
 */

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(index: number) => Result<T>} */
    const at = index => {
        if (array.length <= index) { return undefined }
        return { first: array[index], tail: () => at(index + 1)}
    }
    return at(0)
}

/** @type {<T>(sequence: Sequence<T>) => Result<T>} */
const next = sequence => {
    let i = sequence
    while (true) {
        if (typeof i !== 'function') {
            return i instanceof Array ? fromArray(i) : i
        }
        i = i()
    }
}

/** @type {<T>(sequence: Sequence<T>) => Iterable<T>} */
const iterable = sequence => ({
    *[Symbol.iterator]() {
        let i = sequence
        while (true) {
            if (i === undefined) { 
                return 
            }
            if (i instanceof Array) {
                return yield * i
            }
            if (typeof i === 'function') { 
                i = i() 
            } else  {
                yield i.first
                i = i.tail
            }
        }
    }
})

/** @type {<T>(sequence: Sequence<T>) => readonly T[]} */
const toArray = sequence => {
    if (sequence instanceof Array) { return sequence }
    return Array.from(iterable(sequence))
}

/** @type {(count: number) => Sequence<number>} */
const countdown = count => {
    if (count <= 0) { return undefined }
    const first = count - 1
    return { first, tail: () => countdown(first) }
}

module.exports = {
    /** @readonly */
    next,
    /** @readonly */
    iterable,
    /** @readonly */
    toArray,
    /** @readonly */
    countdown,
}
