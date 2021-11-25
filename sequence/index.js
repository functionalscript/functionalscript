const seqOp = require('./operator')
const { compose } = require('../function')
const op = require('../function/operator')
const { logicalNot, strictEqual } = require('../function/operator')

/**
 * @template T
 * @typedef {() => Result<T>} SequenceFn
 */

/**
 * @template T
 * @typedef {readonly [Sequence<T>, Sequence<T>]} Concat
 */

/**
 * Use `next` function to get `first` and `tail` of the list.
 * 
 * Please note that the sequence also contains `Concat<T>. We need this as 
 * a workaround because modern JavaScript implementations don't support 
 * ES6 TCO (Tail Call Optimization). Without this wotkaround we may have 
 * a stack overflow if a list contains a lot of concateneted lists. 
 *
 * @template T
 * @typedef { SequenceFn<T> | Concat<T>} Sequence
 */

/**
 * @template T
 * @typedef {FirstAndTail<T>|undefined} Result<T>
 */

/**
 * @template T
 * @typedef {readonly[T, Sequence<T>]} FirstAndTail
 */

const empty = () => undefined

/** @type {<F, T>(a: readonly[F, Sequence<T>]) => (b: Sequence<T>) => readonly[F, Sequence<T>]} */
const norm = ([a0, a1]) => b => [a0, [a1, b]]

/** @type {<T>(input: Sequence<T>) => Result<T>} */
const next = input => {
    let i = input
    while (true) {
        if (typeof i === 'function') { return i() }
        const [a, b] = i
        if (typeof a === 'function') { 
            const result = a()
            if (result !== undefined) { 
                return norm(result)(b)
            }
            i = b
        } else {
            i = norm(a)(b)
        }
    }
}

/** @type {<T>(input: Sequence<T>) => T|undefined} */
const first = input => {
    const result = next(input)
    if (result === undefined) { return undefined }
    return result[0]
}

/**
 * @template T
 * @template R
 * @typedef {(list: Sequence<T>) => Sequence<R>} SequenceMap
 */

/**
 * @template T
 * @template R
 * @typedef {(list: Sequence<T>) => R} SequenceReduce
 */

/**
 * Note: the operation is not lazy. It traverse the given array and creates a linked list.
 *  
 * @type {<T>(...array: readonly T[]) => Sequence<T>} 
 */
const list = (...array) => {
    /** @typedef {typeof array extends readonly(infer T)[] ? T : never} T */
    let i = array.length
    /** @type {Sequence<T>} */
    let result = empty
    while (i !== 0) {
        i = i - 1
        /** @type {FirstAndTail<T>} */
        const listResult = [array[i], result]
        result = () => listResult
    }
    return result
}

/** @type {<T>(...array: readonly Sequence<T>[]) => Sequence<T>} */
const concat = (...array) => {
    let i = array.length
    if (i == 0) { return empty }
    i = i - 1
    let result = array[i]
    while (i !== 0) {
        i = i - 1
        result = [array[i], result]
    }
    return result
}

/** @type {(_: number) => Sequence<number>} */
const generate = n => {
    /** @type {(_: number) => Sequence<number>} */
    const f = i => () => {
        if (n <= i) { return undefined }
        return [i, f(i + 1)]
    }
    return f(0)
}

/** @type {<T, R>(f: (value: T) => Sequence<R>) => SequenceMap<T, R>} */
const flatMap = f => input => () => {
    let i = input
    while (true) { 
        const result = next(i)
        if (result === undefined) { return undefined }
        const [first, tail] = result
        const firstResult = next(f(first)) 
        if (firstResult !== undefined) {
            return norm(firstResult)(flatMap(f)(tail))
        }
        i = tail
    }
}

/** @type {<T>(list: Sequence<Sequence<T>>) => Sequence<T>} */
const flat = flatMap(i => i)

/** @type {<T, R>(f: (value: T) => R) => SequenceMap<T, R>} */
const map = f => flatMap(i => list(f(i)))

/** @type {<T>(f: (value: T) => boolean) => SequenceMap<T, T>} */
const filter = f => flatMap(i => f(i) ? list(i) : empty)

/** @type {<T, R>(f: (value: T) => R|undefined) => (value: T) => Sequence<R>} */
const filterMapFunc = f => i => {
    const result = f(i)
    if (result === undefined) { return empty }
    return list(result)
}

/** @type {<T, R>(f: (value: T) => R|undefined) => SequenceMap<T, R>} */
const filterMap = f => flatMap(filterMapFunc(f)) 

/** @type {<T, R>(s: seqOp.Scan<T, R>) => SequenceMap<T, R>} */
const scan = s => input => () => {
    const result = next(input)
    if (result === undefined) {
        return result
    }
    const [first, tail] = result
    const [newFirst, newS] = s(first)
    return [newFirst, scan(newS)(tail)]
}

/** @type {<T, R>(s: seqOp.ExclusiveScan<T, R>) => SequenceMap<T, R>} */
const exclusiveScan = ([first, s]) => input => () => [first, scan(s)(input)]

/** @type {<T>(def: T) => (input: Sequence<T>) => T} */
const last = def => input => {
    let r = def
    let i = input    
    while (true) {
        const result = next(i)
        if (result === undefined) {
            return r
        }
        r = result[0]
        i = result[1]
    }
}

/** @type {<T, R>(s: seqOp.ExclusiveScan<T, R>) => (input: Sequence<T>) => R} */
const reduce = ([first, s]) => input => last(first)(scan(s)(input))

/** @type {<T, R>(ro: op.ReduceOperator<R, T>) => (first: R) => (input: Sequence<T>) => R} */
const fold = ro => first => reduce(seqOp.exclusiveScan(ro)(first))

const entries = scan(seqOp.entries)

const sum = reduce(seqOp.sum)

const length = reduce(seqOp.length)

/** @type {(separator: string) => SequenceReduce<string, string>} */
const join = separator => reduce(seqOp.join(separator))

/** @type {<T>(f: (value: T) => boolean) => SequenceMap<T, T>} */
const takeWhile = f => input => () => {
    const result = next(input)
    if (result === undefined || !f(result[0])) { return undefined }
    return result
}

/** @type {(n: number) => <T>(input: Sequence<T>) => Sequence<T>} */
const drop = n => input => () => {
    let iN = n
    let iInput = input
    while (true) {
        const result = next(iInput)
        if (iN <= 0 || result === undefined) { return result }
        iN = iN - 1
        iInput = result[1]
    }
}

/** @type {(n: number) => <T>(input: Sequence<T>) => T|undefined} */
const at = n => input => first(drop(n)(input))

/** @type {<T>(f: (value: T) => boolean) => SequenceReduce<T, T|undefined>} */
const find = f => input => first(filter(f)(input))

/** @type {<T>(f: (value: T) => boolean) => SequenceReduce<T, boolean>} */
const some = f => input => find(x => x)(map(f)(input)) !== undefined

/** @type {<T>(value: T) => SequenceReduce<T, boolean>} */
const includes = value => some(strictEqual(value))

/** @type {<T>(f: (value: T) => boolean) => SequenceReduce<T, boolean>} */
const every = f => input => !some(compose(logicalNot)(f))(input)

/** @type {<T>(list: Sequence<T>) => Iterable<T>} */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const result = next(i)
            if (result === undefined) { return }
            yield result[0]
            i = result[1]
        }
    }
})

/** @type {<T>(list: Sequence<T>) => AsyncIterable<T>} */
const asyncIterable = list => ({
    async *[Symbol.asyncIterator]() {
        let i = list
        while (true) {
            const result = next(i)
            if (result === undefined) { return }
            yield result[0]
            i = result[1]
        }
    }
})

/** @type {<A>(a: Sequence<A>) => <B>(b: Sequence<B>) => Sequence<readonly[A, B]>} */
const zip = a => b => () => {
    const resultA = next(a)
    if (resultA === undefined) { return undefined }
    const resultB = next(b)
    if (resultB === undefined) { return undefined }
    return [[resultA[0], resultB[0]], zip(resultA[1])(resultB[1])]
}

module.exports = {
    /** @readonly */
    next,
    /** @readonly */
    list,
    /** @readonly */
    empty,
    /** @readonly */
    at,
    /** @readonly */
    concat,
    /** @readonly */
    generate,
    /** @readonly */
    first,
    /** @readonly */
    iterable,
    /** @readonly */
    asyncIterable,
    /** @readonly */
    flatMap,
    /** @readonly */
    flat,
    /** @readonly */
    map,
    /** @readonly */
    filter,
    /** @readonly */
    filterMap,
    /** @readonly */
    scan,
    /** @readonly */
    exclusiveScan,
    /** @readonly */
    last,
    /** @readonly */
    fold,
    /** @readonly */
    reduce,
    /** @readonly */
    entries,
    /** @readonly */
    sum,
    /** @readonly */
    join,
    /** @readonly */
    length,
    /** @readonly */
    drop,
    /** @readonly */
    find,
    /** @readonly */
    takeWhile,
    /** @readonly */
    some,
    /** @readonly */
    every,
    /** @readonly */
    includes,
    /** @readonly */
    zip,
}