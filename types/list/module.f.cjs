const { compose, identity } = require('../function/module.f.cjs')
const operator = require('../function/operator/module.f.cjs')
const {
    counter,
    logicalNot,
    strictEqual,
    stateScanToScan,
    foldToScan,
    reduceToScan
} = operator

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

/** @typedef {null} Empty */

/**
 * @template T
 * @typedef {Empty | NonEmpty<T>} Result
 */

/**
 * @template T
 * @typedef {() => List<T>} Thunk
 */

/**
 * @template T
 * @typedef {{
 *  readonly first: T
 *  readonly tail: List<T>
 * }} NonEmpty
 */

/**
 * @template T
 * @typedef {{
 *  readonly head: List<T>
 *  readonly tail: List<T>
 * }} Concat
 */

/** @type {<T>(array: readonly T[]) => Result<T>} */
const fromArray = array => {
    /** @typedef {typeof array extends readonly (infer T)[] ? T : never} T */
    /** @type {(i: number) => Result<T>} */
    const at = i => i < array.length ? { first: array[i], tail: () => at(i + 1) } : null
    return at(0)
}

/** @type {<T>(head: List<T>) => (tail: List<T>) => List<T>} */
const concat = head => tail => tail === null ? head : ({ head, tail })

/** @type {<T>(list: List<T>) => NotLazy<T> } */
const trampoline = list => {
    while (typeof list === 'function') { list = list() }
    return list
}

/** @type {<T>(list: List<T>) => Result<T>} */
const next = head => {
    /** @type {typeof head} */
    let tail = null
    while (true) {
        head = trampoline(head)

        if (head instanceof Array) {
            head = fromArray(head)
        } else if (head !== null && 'head' in head) {
            [head, tail] = [head.head, concat(head.tail)(tail)]
            continue
        }

        if (head !== null) {
            return { first: head.first, tail: concat(head.tail)(tail) }
        }

        if (tail === null) { return null }

        [head, tail] = [tail, null]
    }
}

/** @type {<T>(list: List<T>) => Iterable<T>} */
const iterable = list => ({
    *[Symbol.iterator]() {
        let i = list
        while (true) {
            const r = next(i)
            if (r === null) { return }
            yield r.first
            i = r.tail
        }
    }
})

const { from } = Array

/** @type {<T>(list: List<T>) => readonly T[]} */
const toArray = list => {
    const u = trampoline(list)
    return u instanceof Array ? u : from(iterable(u))
}

/** @type {<I, O>(step: (n: NonEmpty<I>) => List<O>) => (input: List<I>) => Thunk<O>} */
const apply = f => input => () => {
    const n = next(input)
    if (n === null) { return null }
    return f(n)
}

/** @type {<T>(n: NonEmpty<List<T>>) => List<T>} */
const flatStep = n => concat(n.first)(flat(n.tail))

/** @type {<T>(list: List<List<T>>) => Thunk<T>} */
const flat = apply(flatStep)

/** @type {<I, O>(f: (value: I) => O) => (n: NonEmpty<I>) => List<O>} */
const mapStep = f => n => ({ first: f(n.first), tail: map(f)(n.tail) })

/** @type {<I, O>(f: (value: I) => O) => (input: List<I>) => Thunk<O>} */
const map = f => apply(mapStep(f))

/** @type {<I, O>(f: (value: I) => List<O>) => (input: List<I>) => Thunk<O>} */
const flatMap = f => compose(map(f))(flat)

/** @type {<T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>} */
const filterStep = f => n => {
    const tail = filter(f)(n.tail)
    return f(n.first) ? { first: n.first, tail } : tail
}

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>} */
const filter = f => apply(filterStep(f))

/** @type {<I, O>(f: (value: I) => O|null) => (n: NonEmpty<I>) => List<O>} */
const filterMapStep = f => n => {
    const [first, tail] = [f(n.first), filterMap(f)(n.tail)]
    return first === null ? tail : { first, tail }
}

/** @type {<I, O>(f: (value: I) => O|null) => (input: List<I>) => Thunk<O>} */
const filterMap = f => apply(filterMapStep(f))

/** @type {<T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>} */
const takeWhileStep = f => n => f(n.first) ? { first: n.first, tail: takeWhile(f)(n.tail) } : null

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>} */
const takeWhile = f => apply(takeWhileStep(f))

/** @type {(n: number) => <T>(result: NonEmpty<T>) => List<T>} */
const takeStep = n => ne => 0 < n ? { first: ne.first, tail: take(n - 1)(ne.tail) } : null

/** @type {(n: number) => <T>(input: List<T>) => Thunk<T>} */
const take = n => apply(takeStep(n))

/** @type {<T>(f: (value: T) => boolean) => (ne: NonEmpty<T>) => List<T>} */
const dropWhileStep = f => ne => f(ne.first) ? dropWhile(f)(ne.tail) : ne

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>} */
const dropWhile = f => apply(dropWhileStep(f))

/** @type {(n: number) => <T>(ne: NonEmpty<T>) => List<T>} */
const dropStep = n => ne => 0 < n ? drop(n - 1)(ne.tail) : ne

/** @type {(n: number) => <T>(input: List<T>) => Thunk<T>} */
const drop = n => apply(dropStep(n))

/** @type {<D>(def: D) => <T>(input: List<T>) => D|T} */
const first = def => input => {
    const result = next(input)
    return result === null ? def : result.first
}

/** @type {<D>(first: D) => <T>(tail: List<T>) => D|T} */
const last = first => tail => {
    /** @typedef {typeof tail extends List<infer T> ? T : never} T */
    /** @type {NonEmpty<typeof first|T>} */
    let i = { first, tail }
    while (true) {
        const result = next(i.tail)
        if (result === null) {
            return i.first
        }
        i = result
    }
}

/** @type {<D>(def: D) => <T>(f: (value: T) => boolean) => (input: List<T>) => D|T} */
const find = def => f => input => first(def)(filter(f)(input))

const findTrue = find(false)

/** @type {(input: List<boolean>) => boolean} */
const some = input => findTrue
    (/** @type {(_: boolean) => boolean} */(identity))
    (input)

/** @type {<T>(f: List<T>) => Thunk<boolean>} */
const mapTrue = map(() => true)

/** @type {<T>(input: List<T>) => boolean} */
const isEmpty = input => !some(mapTrue(input))

const mapNot = map(logicalNot)

/** @type {(input: List<boolean>) => boolean} */
const every = input => !some(mapNot(input))

/** @type {<T>(value: T) => (sequence: List<T>) => boolean} */
const includes = value => input => some(map(strictEqual(value))(input))

/** @type {(count: number) => Thunk<number>} */
const countdown = count => () => {
    if (count <= 0) { return null }
    const first = count - 1
    return { first, tail: countdown(first) }
}

/** @type {<T>(v: T) => (c: number) => Thunk<T>} */
const repeat = v => n => map(() => v)(countdown(n))

/** @type {<T>(list: List<T>) => List<T>} */
const cycle = list => () => {
    const i = next(list)
    return i === null ? null : { first: i.first, tail: concat(i.tail)(cycle(list)) }
}

/** @type {<I, O>(op: operator.Scan<I, O>) => (ne: NonEmpty<I>) => List<O>} */
const scanStep = op => ne => {
    const [first, newOp] = op(ne.first)
    return { first, tail: scan(newOp)(ne.tail) }
}

/** @type {<I, O>(op: operator.Scan<I, O>) => (input: List<I>) => Thunk<O>} */
const scan = op => apply(scanStep(op))

/** @type {<I, S, O>(op: operator.StateScan<I, S, O>) => (init: S) => (input: List<I>) => Thunk<O>} */
const stateScan = op => init => scan(stateScanToScan(op)(init))

/** @type {<I,O>(op: operator.Fold<I, O>) => (init: O) => (input: List<I>) => Thunk<O>} */
const foldScan = op => init => scan(foldToScan(op)(init))

/** @type {<I,O>(op: operator.Fold<I, O>) => (init: O) => (input: List<I>) => O} */
const fold = op => init => input => last(init)(foldScan(op)(init)(input))

/** @type {<T>(op: operator.Reduce<T>) => <D>(def: D) => (input: List<T>) => D|T} */
const reduce = op => def => input => last(def)(scan(reduceToScan(op))(input))


/** @type {<T>(input: List<T>) => number} */
const length = fold(counter)(0)

/**
 * @template T
 * @typedef {readonly[number, T]} Entry
 */

/** @type {(index: number) => <T>(value: T) => readonly[Entry<T>, number]} */
const entryOperator = index => value => [[index, value], index + 1]

/** @type {<T>(input: List<T>) => Thunk<Entry<T>>} */
const entries = input => {
    /** @typedef {typeof input extends List<infer T> ? T : never} T */
    /** @type {operator.StateScan<T, Number, Entry<T>>} */
    const o = entryOperator
    return stateScan(o)(0)(input)
}

/** @type {<T>(value: T) => (prior: List<T>) => List<T>} */
const reverseOperator = first => tail => ({ first, tail })

/** @type {<T>(input: List<T>) => List<T>} */
const reverse = fold(reverseOperator)(null)

/** @type {<A>(a: List<A>) => <B>(b: List<B>) => List<readonly[A, B]>} */
const zip = a => b => () => {
    const aResult = next(a)
    if (aResult === null) { return null }
    const bResult = next(b)
    if (bResult === null) { return null }
    return { first: [aResult.first, bResult.first], tail: zip(aResult.tail)(bResult.tail) }
}

/** @type {<T>(e: operator.Equal<T>) => (a: List<T>) => (b: List<T>) => boolean} */
const equal = e => {
    /** @typedef {typeof e extends operator.Equal<infer T> ? T : never} T */
    /** @type {(a: List<T>) => (b: List<T>) => List<boolean>} */
    const f = a => b => () => {
        const [aResult, bResult] = [next(a), next(b)]
        return aResult === null || bResult === null
            ? { first: aResult === bResult, tail: null }
            : { first: e(aResult.first)(bResult.first), tail: f(aResult.tail)(bResult.tail) }
    }
    return a => b => every(f(a)(b))
}

module.exports = {
    /** @readonly */
    empty: null,
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
    repeat,
    /** @readonly */
    cycle,
    /** @readonly */
    scan,
    /** @readonly */
    stateScan,
    /** @readonly */
    foldScan,
    /** @readonly */
    fold,
    /** @readonly */
    reduce,
    /** @readonly */
    length,
    /** @readonly */
    entries,
    /** @readonly */
    reverse,
    /** @readonly */
    zip,
    /** @readonly */
    equal
}
