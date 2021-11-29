const { todo } = require("../dev")
const { compose } = require("../function")
const { sequence } = require("../sequence")

/**
 * @template T
 * @typedef {Result<T> | Lazy<T>} Sequence
 */

/**
 * @template T
 * @typedef {FirstAndTail<T> | undefined} Result
 */

/**
 * @template T
 * @typedef {readonly[T, Sequence<T>]} FirstAndTail
 */

/**
 * @template T
 * @typedef {() => Sequence<T>} Lazy
 */

const empty = undefined

/** @type {<T>(sequence: Sequence<T>) => Result<T>} */
const next = sequence => {
    let i = sequence
    while (true) {
        if (typeof i !== 'function') { return i }
        i = i()
    }
}

/** @type {<T, A>(f: (value: Result<T>) => Sequence<A>) => (source: Sequence<T>) => Sequence<A>} */
const unwrap = f => source => {
    if (typeof source === 'function') { return () => unwrap(f)(source()) }
    return f(source)
}

/** @type {<T>(array: readonly T[]) => Sequence<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(index: number) => Sequence<T>} */
    const f = index => {
        if (array.length <= index) { return undefined }
        return [array[index], () => f(index + 1)]
    }
    return f(0)
}

/** @type {<T>(sequence: Sequence<T>) => Iterable<T>} */
const iterable = sequence => ({
    *[Symbol.iterator]() {
        let i = sequence
        while (true) {
            const result = next(i)
            if (result === undefined) { return }
            const [first, tail] = result
            yield first
            i = tail
        }
    }
})

/** @type {(count: number) => Sequence<number>} */
const countdown = count => {
    if (count <= 0) { return empty }
    const n = count - 1
    return [n, () => countdown(n)]
}

/** @type {<T>(...array: readonly T[]) => Sequence<T>} */
const list = (...array) => fromArray(array)

/** @type {<T>(tail: Sequence<Sequence<T>>) => (sequence: Sequence<T>) => Sequence<T>} */
const flat2 = tail => {
    /** @typedef {typeof tail extends Sequence<Sequence<infer T>> ? T : never} T */
    /** @type {(result: Result<T>) => Sequence<T>} */
    const g2 = result => {
        if (result === undefined) { return () => flat(tail) }
        const [first, resultTail] = result
        return [first, () => g1(resultTail)]
    }
    const g1 = unwrap(g2)
    return g1
}

/** @type {<T>(result: Result<Sequence<T>>) => Sequence<T>} */
const flat1 = result => {
    if (result === undefined) { return undefined }
    const [first, tail] = result
    return flat2(tail)(first)
}

const flat = unwrap(flat1)

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    next,
    /** @readonly */
    fromArray,
    /** @readonly */
    iterable,
    /** @readonly */
    countdown,
    /** @readonly */
    list,
    /** @readonly */
    flat,
}
