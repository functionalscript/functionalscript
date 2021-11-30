const { compose } = require('../function')
const { logicalNot, strictEqual, addition } = require('../function/operator')
const op = require('../function/operator')

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
 * @typedef { Result<T> | Concat<T> } Node<T>
 */

/**
 * @template T
 * @typedef { readonly[Sequence<T>, Sequence<T>] } Concat<T>
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
    const n = next(sequence)
    if (n === undefined) { return undefined }
    const { first, tail } = n
    return [first, flat(tail)]
}

/** @type {<T>(...array: readonly Sequence<T>[]) => Thunk<T>} */
const concat = (...array) => flat(array)

/** @type {<I, O>(f: (value: I) => O) => (input: Sequence<I>) => Thunk<O>} */
const map = f => sequence => () => {
    const n = next(sequence)
    if (n === undefined) { return undefined }
    const { first, tail } = n
    return { first: f(first), tail: map(f)(tail) }
}

/** @type {<I, O>(f: (value: I) => Sequence<O>) => (input: Sequence<I>) => Thunk<O>} */
const flatMap = f => sequence => flat(map(f)(sequence))

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const filter = f => sequence => () => {
    const n = next(sequence)
    if (n === undefined) { return undefined }
    const { first, tail } = n
    const fTail = filter(f)(tail)
    return f(first) ? { first, tail: fTail } : fTail()
}

/** @type {<I, O>(f: (value: I) => O|undefined) => (input: Sequence<I>) => Thunk<O>} */
const filterMap = f => sequence => () => {
    const n = next(sequence)
    if (n === undefined) { return undefined }
    const { first, tail } = n
    const fFirst = f(first)
    const fTail = filterMap(f)(tail)
    return fFirst === undefined ? fTail() : { first: fFirst, tail: fTail }
}

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const takeWhile = f => input => () => {
    const result = next(input)
    if (result === undefined) { return undefined }
    const { first, tail } = result
    if (!f(first)) { return undefined }
    return { first, tail: takeWhile(f)(result.tail) }
}

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const dropWhile = f => input => () => {
    let i = input
    while (true) {
        const result = next(i)
        if (result === undefined) { return undefined }
        const { first, tail } = result
        if (!f(first)) return result
        i = tail
    }
}

/** @type {<D>(def: D) => <T>(input: Sequence<T>) => D|T} */
const first = def => input => {
    const result = next(input)
    if (result === undefined) { return def }
    return result.first
}

/** @type {<D>(def: D) => <T>(input: Sequence<T>) => D|T} */
const last = def => input => {
    /** @typedef {typeof input extends Sequence<infer T> ? T : never} T */
    /** @type {(typeof def)|T} */
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

/** @type {<D>(def: D) => <T>(f: (value: T) => boolean) => (sequence: Sequence<T>) => D|T} */
const find = def => f => input => first(def)(filter(f)(input))

/** @type {<T>(f: (value: T) => boolean) => (sequence: Sequence<T>) => boolean} */
const some = f => input => find(false)(x => x)(map(f)(input))

/** @type {<T>(f: (value: T) => boolean) => (sequence: Sequence<T>) => boolean} */
const every = f => input => !some(compose(f)(logicalNot))(input)

/** @type {<T>(value: T) => (sequence: Sequence<T>) => boolean} */
const includes = value => some(strictEqual(value))

/** @type {(count: number) => Thunk<number>} */
const countdown = count => () => {
    if (count <= 0) { return undefined }
    const first = count - 1
    return { first, tail: countdown(first) }
}

/**
 * @template T,A
 * @typedef {(value: T) => ScanState<T, A>} ScanFunc
 */

/**
 * @template T,A
 * @typedef {readonly[A, ScanFunc<T, A>]} ScanState
 */

/** @type {<T,A>(operator: ScanFunc<T, A>) => (input: Sequence<T>) => Sequence<A>} */
const scan = operator => input => () => {
    const result = next(input)
    if (result === undefined) { return undefined }
    const { first, tail } = result
    const r = operator(first)
    return { first: r[0], tail: scan(r[1])(tail) }
}

/** @type {<T,A>(operator: ScanFunc<T, A>) => <D>(def: D)=> (input: Sequence<T>) => D|A} */
const scanReduce = operator => def => input => last(def)(scan(operator)(input))

/**
 * @template T,A 
 * @typedef {(prior: A) => (value: T) => A} ReduceOperator
 */

/** @type {<T,A>(operator: ReduceOperator<T, A>) => (init: A) => ScanState<T, A>} */
const scanState = operator => init => [init, scanFunc(operator)(init)]

/** @type {<T,A>(operator: ReduceOperator<T, A>) => (init: A) => ScanFunc<T, A>} */
const scanFunc = operator => init => value => {
    const result = operator(init)(value)
    return scanState(operator)(result)
}

/** @type {<T,A>(operator: ReduceOperator<T, A>) => (init: A) => (input: Sequence<T>) => A} */
const reduce = operator => init => scanReduce(scanFunc(operator)(init))(init)

/** @type {<T>(operator: ReduceOperator<T, T>) => <D>(def: D) => (input: Sequence<T>) => D|T} */
const fold = operator => def => scanReduce(scanState(operator))(def)

const sum = fold(addition)(0)

/** @type {(separator: string) => (input: Sequence<string>) => string} */
const join = separator => fold(op.join(separator))('')

/**
 * @template T
 * @typedef {readonly[number, T]} Entry
 */

/** @type {(index: number) => <T>(value: T) => ScanState<T, Entry<T>>} */
const entryOp = index => value => [[index, value], entryOp(index + 1)]

/** @type {<T>(input: Sequence<T>) => Sequence<Entry<T>>} */
const entries = scan(entryOp(0))

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
    some,
    /** @readonly */
    every,
    /** @readonly */
    includes,    
    /** @readonly */
    takeWhile,
    /** @readonly */
    dropWhile,
    /** @readonly */
    scanFunc,
    /** @readonly */
    scanState,
    /** @readonly */
    scan,
    /** @readonly */
    reduce,
    /** @readonly */
    fold,
    /** @readonly */
    sum,
    /** @readonly */
    join,
    /** @readonly */
    entries,
    /** @readonly */
    countdown,
}
