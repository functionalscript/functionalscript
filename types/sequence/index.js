const { compose, identity } = require('../function')
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
 * @typedef { undefined | ResultOne<T> } Result
 */

/**
 * @template T
 * @typedef {{ readonly first: T, readonly tail: Sequence<T> }} ResultOne
 */

const empty = () => undefined

/** @type {<T>(first: T) => (tail: Sequence<T>) => Sequence<T>} */
const sequence = first => tail => () => ({ first, tail })

/** @type {<T>(sequence: Sequence<T>) => Node<T>} */
const nodeOne = sequence => [empty, sequence]

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

/** @type {<T>(a: Sequence<T>) => (b: Sequence<T>) => Thunk<T>} */
const concat = a => b => () => [a, b]

/** @type {<T>(sequence: Sequence<T>) => Result<T>} */
const next = sequence => {
    let i = sequence
    while (true) {
        const n = node(i)
        if (!(n instanceof Array)) { return n }
        const [a, b] = n
        const aNode = node(a)
        if (aNode === undefined) {
            i = b
        } else if (aNode instanceof Array) {
            const [aa, ab] = aNode
            i = concat(aa)(concat(ab)(b))
        } else {
            const { first, tail } = aNode
            return { first, tail: concat(tail)(b) }
        }
    }
}

/** @type {<T>(sequence: Sequence<T>) => Iterable<T>} */
const iterable = sequence => ({
    *[Symbol.iterator]() {
        let i = sequence
        while (true) {
            const n = next(i)
            if (n === undefined) { return }
            const { first, tail } = n
            yield first
            i = tail
        }
    }
})

/** @type {<T>(sequence: Sequence<T>) => readonly T[]} */
const toArray = sequence => {
    if (sequence instanceof Array) { return sequence }
    return Array.from(iterable(sequence))
}

/** @type {<I, O>(step: (result: ResultOne<I>) => Node<O>) => (input: Sequence<I>) => Thunk<O>} */
const apply = f => input => () => {
    const n = next(input)
    if (n === undefined) { return undefined }
    return f(n)
}

/** @type {<T>(result: ResultOne<Sequence<T>>) => Node<T>} */
const flatStep = ({first, tail}) => [first, flat(tail)]

/** @type {<T>(sequence: Sequence<Sequence<T>>) => Thunk<T>} */
const flat = apply(flatStep)

/** @type {<I, O>(f: (value: I) => O) => (result: ResultOne<I>) => Node<O>} */
const mapStep = f => ({ first, tail }) => ({ first: f(first), tail: map(f)(tail) })

/** @type {<I, O>(f: (value: I) => O) => (input: Sequence<I>) => Thunk<O>} */
const map = f => apply(mapStep(f))

/** @type {<I, O>(f: (value: I) => Sequence<O>) => (input: Sequence<I>) => Thunk<O>} */
const flatMap = f => compose(map(f))(flat)

/** @type {<T>(f: (value: T) => boolean) => (result: ResultOne<T>) => Node<T>} */
const filterStep = f => ({ first, tail }) => {
    const fTail = filter(f)(tail)
    return f(first) ? { first, tail: fTail } : nodeOne(fTail)
}

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const filter = f => apply(filterStep(f))

/** @type {<I, O>(f: (value: I) => O|undefined) => (result: ResultOne<I>) => Node<O>} */
const filterMapStep = f => ({first, tail}) => {
    const fFirst = f(first)
    const fTail = filterMap(f)(tail)
    return fFirst === undefined ? nodeOne(fTail) : { first: fFirst, tail: fTail }
}

/** @type {<I, O>(f: (value: I) => O|undefined) => (input: Sequence<I>) => Thunk<O>} */
const filterMap = f => apply(filterMapStep(f))

/** @type {<T>(f: (value: T) => boolean) => (result: ResultOne<T>) => Node<T>} */
const takeWhileStep = f => ({ first, tail }) => f(first) ? { first, tail: takeWhile(f)(tail) } :undefined

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const takeWhile = f => apply(takeWhileStep(f))

/** @type {(n: number) => <T>(result: ResultOne<T>) => Node<T>} */
const takeStep = n => ({ first, tail }) => 0 < n ? { first, tail: take(n - 1)(tail) } : undefined

/** @type {(n: number) => <T>(result: Sequence<T>) => Sequence<T>} */
const take = n => apply(takeStep(n))

/** @type {<T>(f: (value: T) => boolean) => (result: ResultOne<T>) => Node<T>} */
const dropWhileStep = f => result => {
    const { first, tail } = result
    return f(first) ? nodeOne(dropWhile(f)(tail)) : result
}

/** @type {<T>(f: (value: T) => boolean) => (input: Sequence<T>) => Thunk<T>} */
const dropWhile = f => apply(dropWhileStep(f))

/** @type {(n: number) => <T>(result: ResultOne<T>) => Node<T>} */
const dropFn = n => result => 0 < n ? nodeOne(drop(n - 1)(result.tail)) : result

/** @type {(n: number) => <T>(result: Sequence<T>) => Sequence<T>} */
const drop = n => apply(dropFn(n))

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


/** @type {(sequence: Sequence<boolean>) => boolean} */
const some = input => find
    (false)
    (/** @type {(_: boolean) => boolean} */(identity))
    (input)

/** @type {(sequence: Sequence<boolean>) => boolean} */
const every = input => !some(map(logicalNot)(input))

/** @type {<T>(value: T) => (sequence: Sequence<T>) => boolean} */
const includes = value => input => some(map(strictEqual(value))(input))

/** @type {(count: number) => Thunk<number>} */
const countdown = count => () => {
    if (count <= 0) { return undefined }
    const first = count - 1
    return { first, tail: countdown(first) }
}

/**
 * @template T,A
 * @typedef {(value: T) => ScanState<T, A>} ScanOperator
 */

/**
 * @template T,A
 * @typedef {readonly[A, ScanOperator<T, A>]} ScanState
 */

/** @type {<T,A>(operator: ScanOperator<T, A>) => (result: ResultOne<T>) => Node<A>} */
const scanFn = operator => ({first, tail}) => {
    const [value, nextOperator] = operator(first)
    return { first: value, tail: scan(nextOperator)(tail) }
}

/** @type {<T,A>(operator: ScanOperator<T, A>) => (input: Sequence<T>) => Thunk<A>} */
const scan = operator => apply(scanFn(operator))

/** @type {<T,A>(operator: ScanOperator<T, A>) => <D>(def: D)=> (input: Sequence<T>) => D|A} */
const scanReduce = operator => def => input => last(def)(scan(operator)(input))

/**
 * @template T,A 
 * @typedef {(prior: A) => (value: T) => A} ReduceOperator
 */

/** @type {<T,A>(operator: ReduceOperator<T, A>) => (init: A) => ScanState<T, A>} */
const scanState = operator => init => [init, scanOperator(operator)(init)]

/** @type {<T,A>(operator: ReduceOperator<T, A>) => (init: A) => ScanOperator<T, A>} */
const scanOperator = operator => init => value => scanState(operator)(operator(init)(value))

/** @type {<T,A>(operator: ReduceOperator<T, A>) => (init: A) => (input: Sequence<T>) => A} */
const reduce = operator => init => scanReduce(scanOperator(operator)(init))(init)

/** 
 * @template T
 * @typedef {ReduceOperator<T, T>} FoldOperator
 */

/** @type {<T>(operator: FoldOperator<T>) => <D>(def: D) => (input: Sequence<T>) => D|T} */
const fold = operator => def => scanReduce(scanState(operator))(def)

const sum = fold(addition)(0)

const min = fold(op.min)(undefined)

const max = fold(op.max)(undefined)

/** @type {(separator: string) => (input: Sequence<string>) => string} */
const join = separator => fold(op.join(separator))('')

/** @type {(a: number) => () => number} */
const counter = a => () => a + 1

/** @type {<T>(input: Sequence<T>) => number} */
const length = reduce(counter)(0)

/**
 * @template T
 * @typedef {readonly[number, T]} Entry
 */

/** @type {(index: number) => <T>(value: T) => ScanState<T, Entry<T>>} */
const entryOp = index => value => [[index, value], entryOp(index + 1)]

/** @type {<T>(input: Sequence<T>) => Thunk<Entry<T>>} */
const entries = scan(entryOp(0))

/** @type {<T>(prior: Sequence<T>) => (value: T) => Sequence<T>} */
const reverseOp = prior => value => sequence(value)(prior)

/** @type {<T>(input: Sequence<T>) => Sequence<T>} */
const reverse = reduce(reverseOp)(empty)

/** @type {<A>(a: Sequence<A>) => <B>(b: Sequence<B>) => Thunk<readonly[A, B]>} */
const zip = a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return undefined }
    const bResult = next(b)
    if (bResult === undefined) { return undefined }
    return { first: [aResult.first, bResult.first], tail: zip(aResult.tail)(bResult.tail) }
}

/** @type {<T>(e: op.Equal<T>) => (a: Sequence<T>) => (b: Sequence<T>) => Thunk<boolean>} */
const equalZip = e => a => b => () => {
    const aResult = next(a)
    const bResult = next(b)
    if (aResult === undefined || bResult === undefined) {
        return { first: aResult === bResult, tail: empty }
    }
    return { first: e(aResult.first)(bResult.first), tail: equalZip(e)(aResult.tail)(bResult.tail) }
}

/** @type {<T>(e: op.Equal<T>) => (a: Sequence<T>) => (b: Sequence<T>) => boolean} */
const equal = e => a => b => every(equalZip(e)(a)(b))

module.exports = {
    /** @readonly */
    sequence,
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
    filterMap,
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
    take,
    /** @readonly */
    dropWhile,
    /** @readonly */
    drop,
    /** @readonly */
    scanOperator,
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
    min,
    /** @readonly */
    max,
    /** @readonly */
    join,
    /** @readonly */
    entries,
    /** @readonly */
    length,
    /** @readonly */
    reverse,
    /** @readonly */
    zip,
    /** @readonly */
    equal,
    /** @readonly */
    countdown,    
}
