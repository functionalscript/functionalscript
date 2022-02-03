const { compose, identity } = require('../function')
const operator = require('../function/operator')
const { logicalNot, strictEqual, stateScanToScan, reduceToScan, foldToScan } = require('../function/operator')

/**
 * @template T
 * @typedef {NotLazy<T> | Thunk<T>} List
 */

/**
 * @template T
 * @typedef {|
 *  Result<T> |
 *  Concat<T> |
 *  readonly T[]
 * } NotLazy
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

/** @type {(i: number) => <T>(array: readonly T[]) => Result<T>} */
const fromArrayAt = i => array => i < array.length ? nonEmpty(array[i])(() => fromArrayAt(i + 1)(array)) : undefined

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = fromArrayAt(0)

/** @type {<T>(a: List<T>) => (b: List<T>) => List<T>} */
const concat = a => b => b === undefined ? a : ({ isConcat: true, a, b })

/** @type {<T>(list: List<T>) => NotLazy<T> } */
const trampoline = list => {
    let i = list
    while (typeof i === 'function') { i = i() }
    return i
}

/** @type {<T>(list: List<T>) => Result<T>} */
const next = list => {
    /** @type {readonly[typeof list, typeof list]} */
    let [a, b] = [list, undefined]
    while (true) {
        a = trampoline(a)

        if (a instanceof Array) {
            a = fromArray(a)
        } else if (a?.isConcat) {
            [a, b] = [a.a, concat(a.b)(b)]
            continue
        }

        if (a !== undefined) {
            return nonEmpty(a.first)(concat(a.tail)(b))
        }

        if (b === undefined) { return undefined }

        [a, b] = [b, undefined]
    }
}

/** @type {<T>(list: List<T>) => Iterable<T>} */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const r = next(i)
            if (r === undefined) { return }
            yield r.first
            i = r.tail
        }
    }
})

/** @type {<T>(list: List<T>) => readonly T[]} */
const toArray = list => {
    const u = trampoline(list)
    return u instanceof Array ? u : Array.from(iterable(u))
}

/** @type {<I, O>(step: (n: NonEmpty<I>) => List<O>) => (input: List<I>) => List<O>} */
const apply = f => input => () => {
    const n = next(input)
    if (n === undefined) { return undefined }
    return f(n)
}

/** @type {<T>(n: NonEmpty<List<T>>) => List<T>} */
const flatStep = n => concat(n.first)(flat(n.tail))

/** @type {<T>(list: List<List<T>>) => List<T>} */
const flat = apply(flatStep)

/** @type {<I, O>(f: (value: I) => O) => (n: NonEmpty<I>) => List<O>} */
const mapStep = f => n => nonEmpty(f(n.first))(map(f)(n.tail))

/** @type {<I, O>(f: (value: I) => O) => (input: List<I>) => List<O>} */
const map = f => apply(mapStep(f))

/** @type {<I, O>(f: (value: I) => List<O>) => (input: List<I>) => List<O>} */
const flatMap = f => compose(map(f))(flat)

/** @type {<T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>} */
const filterStep = f => n => {
    const tail = filter(f)(n.tail)
    return f(n.first) ? nonEmpty(n.first)(tail) : tail
}

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => List<T>} */
const filter = f => apply(filterStep(f))

/** @type {<I, O>(f: (value: I) => O|undefined) => (n: NonEmpty<I>) => List<O>} */
const filterMapStep = f => n => {
    const [first, tail] = [f(n.first), filterMap(f)(n.tail)]
    return first === undefined ? tail : nonEmpty(first)(tail)
}

/** @type {<I, O>(f: (value: I) => O|undefined) => (input: List<I>) => List<O>} */
const filterMap = f => apply(filterMapStep(f))

/** @type {<T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>} */
const takeWhileStep = f => n => f(n.first) ? nonEmpty(n.first)(takeWhile(f)(n.tail)) : undefined

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => List<T>} */
const takeWhile = f => apply(takeWhileStep(f))

/** @type {(n: number) => <T>(result: NonEmpty<T>) => List<T>} */
const takeStep = n => ne => 0 < n ? nonEmpty(ne.first)(take(n - 1)(ne.tail)) : undefined

/** @type {(n: number) => <T>(input: List<T>) => List<T>} */
const take = n => apply(takeStep(n))

/** @type {<T>(f: (value: T) => boolean) => (ne: NonEmpty<T>) => List<T>} */
const dropWhileStep = f => ne => f(ne.first) ? dropWhile(f)(ne.tail) : ne

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => List<T>} */
const dropWhile = f => apply(dropWhileStep(f))

/** @type {(n: number) => <T>(ne: NonEmpty<T>) => List<T>} */
const dropStep = n => ne => 0 < n ? drop(n - 1)(ne.tail) : ne

/** @type {(n: number) => <T>(input: List<T>) => List<T>} */
const drop = n => apply(dropStep(n))

/** @type {<D>(def: D) => <T>(input: List<T>) => D|T} */
const first = def => input => {
    const result = next(input)
    if (result === undefined) { return def }
    return result.first
}

/** @type {<D>(def: D) => <T>(input: List<T>) => D|T} */
const last = def => input => {
    /** @typedef {typeof input extends List<infer T> ? T : never} T */
    let i = nonEmpty(/** @type {(typeof def)|T} */(def))(input)
    while (true) {
        const result = next(i.tail)
        if (result === undefined) {
            return i.first
        }
        i = result
    }
}

/** @type {<D>(def: D) => <T>(f: (value: T) => boolean) => (input: List<T>) => D|T} */
const find = def => f => input => first(def)(filter(f)(input))

/** @type {(input: List<boolean>) => boolean} */
const some = input => find
    (false)
    (/** @type {(_: boolean) => boolean} */(identity))
    (input)

/** @type {<T>(input: List<T>) => boolean} */
const isEmpty = input => !some(map(() => true)(input))

/** @type {(input: List<boolean>) => boolean} */
const every = input => !some(map(logicalNot)(input))

/** @type {<T>(value: T) => (sequence: List<T>) => boolean} */
const includes = value => input => some(map(strictEqual(value))(input))

/** @type {(count: number) => Thunk<number>} */
const countdown = count => () => {
    if (count <= 0) { return undefined }
    const first = count - 1
    return nonEmpty(first)(countdown(first))
}

/** @type {<T>(list: List<T>) => List<T>} */
const cycle = list => () => {
    const i = next(list)
    return i === undefined ? undefined : nonEmpty(i.first)(concat(i.tail)(cycle(list)))
}

/** @type {<I, O>(op: operator.Scan<I, O>) => (ne: NonEmpty<I>) => List<O>} */
const scanStep = op => ne => {
    const [o, newOp] = op(ne.first)
    return nonEmpty(o)(scan(newOp)(ne.tail))
}

/** @type {<I, O>(op: operator.Scan<I, O>) => (input: List<I>) => List<O>} */
const scan = op => apply(scanStep(op))

/** @type {<I, S, O>(op: operator.StateScan<I, S, O>) => (init: S) => (input: List<I>) => List<O>} */
const stateScan = op => init => scan(stateScanToScan(op)(init))

/** @type {<I,O>(op: operator.Reduce<I, O>) => (init: O) => (input: List<I>) => List<O>} */
const reduceScan = op => init => scan(reduceToScan(op)(init))

/** @type {<I,O>(op: operator.Reduce<I, O>) => (init: O) => (input: List<I>) => O} */
const reduce = op => init => input => last(init)(reduceScan(op)(init)(input))

/** @type {<T>(op: operator.Fold<T>) => <D>(def: D) => (input: List<T>) => D|T} */
const fold = op => def => input => last(def)(scan(foldToScan(op))(input))

const sum = fold(operator.addition)(0)

const min = fold(operator.min)(undefined)

const max = fold(operator.max)(undefined)

/** @type {(separator: string) => (input: List<string>) => string} */
const join = separator => fold(operator.join(separator))('')

/** @type {<T>(input: List<T>) => number} */
const length = reduce(operator.counter)(0)

/**
 * @template T
 * @typedef {readonly[number, T]} Entry
 */

/** @type {(index: number) => <T>(value: T) => readonly[Entry<T>, number]} */
const entryOperator = index => value => [[index, value], index + 1]

/** @type {<T>(input: List<T>) => List<Entry<T>>} */
const entries = (input) => {
    /** @typedef {typeof input extends List<infer T> ? T : never} T */
    return stateScan(/** @type {operator.StateScan<T, Number, Entry<T>>} */(entryOperator))(0)(input)
}

/** @type {<T>(prior: List<T>) => (value: T) => List<T>} */
const reverseOperator = prior => value => nonEmpty(value)(prior)

/** @type {<T>(input: List<T>) => List<T>} */
const reverse = reduce(reverseOperator)(undefined)

/** @type {<A>(a: A) => <B>(b: B) => readonly[A, B]} */
const tuple2 = a => b => [a, b]

/** @type {<A>(a: List<A>) => <B>(b: List<B>) => List<readonly[A, B]>} */
const zip = a => b => () => {
    const aResult = next(a)
    if (aResult === undefined) { return undefined }
    const bResult = next(b)
    if (bResult === undefined) { return undefined }
    return nonEmpty(tuple2(aResult.first)(bResult.first))(zip(aResult.tail)(bResult.tail))
}

/** @type {<T>(e: operator.Equal<T>) => (a: List<T>) => (b: List<T>) => List<boolean>} */
const equalZip = e => a => b => () => {
    const [aResult, bResult] = [next(a), next(b)]
    return aResult === undefined || bResult === undefined
        ? nonEmpty(aResult === bResult)(undefined)
        : nonEmpty(e(aResult.first)(bResult.first))(equalZip(e)(aResult.tail)(bResult.tail))
}

/** @type {<T>(e: operator.Equal<T>) => (a: List<T>) => (b: List<T>) => boolean} */
const equal = e => a => b => every(equalZip(e)(a)(b))

/** @type {(s: string) => List<number>} */
const toCharCodes = s => {
    /** @type {(i: number) => List<number>} */
    const at = i => () => {
        const r = s.charCodeAt(i)
        if (isNaN(r)) { return undefined }
        return { first: r, tail: at(i + 1) }
    }
    return at(0)
}

/** @type {(x: List<number>) => string} */
const fromCharCodes = x => fold(operator.concat)('')(map(String.fromCharCode)(x))

module.exports = {
    /** @readonly */
    empty: undefined,
    /** @readonly */
    nonEmpty,
    /** @readonly */
    concat,
    /** @readonly */
    next,
    /** @readonly */
    iterable,
    /** @readonly */
    toArray,
    /** @readonly */
    flat,
    /** @readonly */
    map,
    /** @readonly */
    flatMap,
    /** @readonly */
    filter,
    /** @readonly */
    filterMap,
    /** @readonly */
    takeWhile,
    /** @readonly */
    take,
    /** @readonly */
    dropWhile,
    /** @readonly */
    drop,
    /** @readonly */
    first,
    /** @readonly */
    last,
    /** @readonly */
    find,
    /** @readonly */
    some,
    /** @readonly */
    every,
    /** @readonly */
    isEmpty,
    /** @readonly */
    includes,
    /** @readonly */
    countdown,
    /** @readonly */
    cycle,
    /** @readonly */
    scan,
    /** @readonly */
    stateScan,
    /** @readonly */
    reduceScan,
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
    length,
    /** @readonly */
    entries,
    /** @readonly */
    reverse,
    /** @readonly */
    zip,
    /** @readonly */
    equal,
    /** @readonly */
    toCharCodes,
    /** @readonly */
    fromCharCodes,
}
