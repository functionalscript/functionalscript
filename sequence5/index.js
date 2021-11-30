/**
 * @template T
 * @typedef { readonly T[] | Thunk<T> } Sequence<T>
 */

/**
 * @template T
 * @typedef { () => Node<T> } Thunk
 */

/**
 * @template T
 * @typedef { readonly[Sequence<T>, Sequence<T>] } Concat<T>
 */

/**
 * @template T
 * @typedef { Result<T> | Concat<T> } Node<T>
 */

/**
 * @template T
 * @typedef { undefined | { readonly first: T, readonly tail: Sequence<T> } } Result
 */

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    /** @type {(index: number) => Result<T>} */
    const at = index => {
        if (array.length <= index) { return undefined }
        return { first: array[index], tail: () => at(index + 1) }
    }
    return at(0)
}

/** @type {<T>(sequence: Sequence<T>) => Node<T>} */
const node = sequence => sequence instanceof Array ? fromArray(sequence) : sequence()

/** @type {<T>(concat: Concat<T>) => Sequence<T>} */
const concatNext = ([a, b]) => {
    const result = node(a)
    if (result === undefined) {
        return b
    } else if (result instanceof Array) {
        const [aa, ab] = result
        return () => [aa, () => [ab, b]]
    } else {
        const { first, tail } = result
        return () => ({ first, tail: () => [tail, b] })
    }
}

/** @type {<T>(sequence: Sequence<T>) => Result<T>} */
const next = sequence => {
    let i = sequence
    while (true) {
        const n = node(i)
        if (!(n instanceof Array)) { return n }
        i = concatNext(n)
    }
}

/** @type {<T>(sequence: Sequence<T>) => Iterable<T>} */
const iterable = sequence => ({
    *[Symbol.iterator]() {
        let i = sequence
        while (true) {
            if (i instanceof Array) { return yield *i }
            const n = node(i)
            if (n === undefined) { return }
            if (n instanceof Array) {
                i = concatNext(n)
            } else {
                const { first, tail } = n
                yield first
                i = tail
            }
        }
    }
})

/** @type {<T>(sequence: Sequence<T>) => readonly T[]} */
const toArray = sequence => {
    if (sequence instanceof Array) { return sequence }
    return Array.from(iterable(sequence))
}

/** @type {<T>(sequence: Sequence<Sequence<T>>) => Sequence<T>} */
const flat = sequence => {
    const n = node(sequence)
    if (n === undefined) { return [] }
    if (n instanceof Array) { 
        const [a, b] = n
        return () => [flat(a), flat(b)]
    }
    const { first, tail } = n
    return () => [first, flat(tail)]
}

/** @type {<T>(...array: readonly Sequence<T>[]) => Sequence<T>} */
const concat = (...array) => flat(array)

/** @type {<T>(input: Sequence<T>) => T|undefined} */
const first = input => {
    const result = next(input)
    if (result === undefined) { return undefined }
    return result.first
}

/** @type {(count: number) => Sequence<number>} */
const countdown = count => {
    if (count <= 0) { return [] }
    const first = count - 1
    return () => ({ first, tail: countdown(first) })
}

module.exports = {
    /** @readonly */
    iterable,
    /** @readonly */
    next,
    /** @readonly */
    toArray,
    /** @readonly */
    flat,
    /** @readonly */
    concat,
    /** @readonly */
    first,
    /** @readonly */
    countdown,
}
