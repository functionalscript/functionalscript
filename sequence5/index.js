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

const empty = () => undefined

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

/** @type {<T>(sequence: Sequence<Sequence<T>>) => Thunk<T>} */
const flat = sequence => () => {
    const n = node(sequence)
    if (n === undefined) { return undefined }
    if (n instanceof Array) { 
        const [a, b] = n
        return [flat(a), flat(b)]
    }
    const { first, tail } = n
    return [first, flat(tail)]
}

/** @type {<T>(...array: readonly Sequence<T>[]) => Thunk<T>} */
const concat = (...array) => flat(array)

/** @type {<I, O>(f: (value: I) => O) => (input: Sequence<I>) => Thunk<O>} */
const map = f => sequence => () => {
    const n = node(sequence)
    if (n === undefined) { return undefined }
    if (n instanceof Array) {
        const [a, b] = n
        return [map(f)(a), map(f)(b)]
    }
    const { first, tail } = n
    return { first: f(first), tail: map(f)(tail) }
}

/** @type {<I, O>(f: (value: I) => Sequence<O>) => (input: Sequence<I>) => Thunk<O>} */
const flatMap = f => sequence => flat(map(f)(sequence))

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const filter = f => sequence => () => {
    const n = node(sequence)
    if (n === undefined) { return undefined }
    if (n instanceof Array) {
        const [a, b] = n
        return [filter(f)(a), filter(f)(b)]
    }
    const { first, tail } = n
    const fTail = filter(f)(tail)
    return f(first) ? { first, tail: fTail } : fTail()
}

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const takeWhile = f => input => () => {
    const result = next(input)
    if (result === undefined) { return undefined }
    const { first, tail } = result
    if (!f(first)) { return undefined }
    return { first, tail: takeWhile(f)(result.tail) }
}

/** @type {<T>(input: Sequence<T>) => T|undefined} */
const first = input => {
    const result = next(input)
    if (result === undefined) { return undefined }
    return result.first
}

/** @type {<T>(def: T) => (input: Sequence<T>) => T} */
const last = def => input => {
    let r = def
    let i = input
    while (true) {
        const result = next(i)
        if (result === undefined) {
            return r
        }
        r = result.first
        i = result.tail
    }
}

/** @type {<T>(f: (value: T) => boolean) => (sequence: Sequence<T>) => T|undefined} */
const find = f => input => first(filter(f)(input))

/** @type {(count: number) => Thunk<number>} */
const countdown = count => () => {
    if (count <= 0) { return undefined }
    const first = count - 1
    return { first, tail: countdown(first) }
}

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    iterable,
    /** @readonly */
    next,
    /** @readonly */
    toArray,
    /** @readonly */
    flat,
    /** @readonly */
    last,
    /** @readonly */
    concat,
    /** @readonly */
    first,
    /** @readonly */
    map,
    /** @readonly */
    flatMap,
    /** @readonly */
    filter,
    /** @readonly */
    find,
    /** @readonly */
    takeWhile,
    /** @readonly */
    countdown,
}
