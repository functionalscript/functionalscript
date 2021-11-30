const { todo } = require("../dev")
const { compose } = require("../function")

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

/** @type {<T>(arrayOrResult: ArrayOrResult<T>) => Result<T>} */
const toResult = arrayOrResult => arrayOrResult instanceof Array ? fromArray(arrayOrResult) : arrayOrResult

/** @type {<T>(sequence: Sequence<T>) => Result<T>} */
const next = sequence => {
    let i = sequence
    while (true) {
        if (typeof i !== 'function') {
            return toResult(i)
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

/** @type {<T>(input: Sequence<T>) => T|undefined} */
const first = input => {
    const result = next(input)
    if (result === undefined) { return undefined }
    return result.first
}

/** @type {(count: number) => Sequence<number>} */
const countdown = count => {
    if (count <= 0) { return undefined }
    const first = count - 1
    return { first, tail: () => countdown(first) }
}

/** @type {<T>(tail2: Sequence<Sequence<T>>) => (sequence: Sequence<T>)=> Sequence<T>} */
const flat2 = tail2 => {
    /** @typedef {typeof tail2 extends Sequence<Sequence<infer T>> ? T : never} T */
    /** @type {(sequence: Sequence<T>)=> Sequence<T>} */
    const f2 = sequence => {
        const result = next(sequence)
        if (result === undefined) { return flat(tail2) }
        const { first, tail } = result
        return { first, tail: f2(tail) }
    }
    return f2
}

/** @type {<T>(sequence: Sequence<Sequence<T>>) => Sequence<T>} */
const flat = sequence => {
    const result = next(sequence)
    if (result === undefined) { return undefined }
    const { first, tail } = result
    return flat2(tail)(first)
}

/** @type {<T>(...array: readonly Sequence<T>[]) => Sequence<T>} */
const concat = (...array) => flat(array)

module.exports = {
    /** @readonly */
    next,
    /** @readonly */
    first,
    /** @readonly */
    iterable,
    /** @readonly */
    toArray,
    /** @readonly */
    concat,
    /** @readonly */
    countdown,
}
