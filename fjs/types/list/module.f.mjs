/**
 * Immutable list data structure utilities and combinators.
 *
 * @module
 */
import { identity, fn, compose } from '../function/module.f.mjs'
/** @import { Nullable } from '../nullable/module.f.mjs' */
import {
    addition,
    logicalNot,
    strictEqual,
    stateScanToScan,
    foldToScan,
    reduceToScan,
} from '../function/operator/module.f.mjs'
/** @import {Scan, StateScan, Fold, Reduce, Equal} from '../function/operator/module.f.mjs' */

/**
 * @template T
 * @typedef {NotLazy<T> | Thunk<T>} List
 */

/**
 * @template T
 * @typedef {Result<T> |
 *  Concat<T> |
 *   readonly T[]
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
 * See also https://en.wikipedia.org/wiki/Cons#Lists
 *
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

export const fromArrayLike =
    /**
     * @template T
     * @param {ArrayLike<T>} array
     * @result {Result<T>}
     */
    array => {
        /** @type {(i: number) => Result<T>} */
        const at = i =>
            i < array.length ? { first: array[i], tail: () => at(i + 1) } : null
        return at(0)
    }

/** @type {<T>(head: List<T>) => (tail: List<T>) => List<T>} */
export const concat = head => tail =>
    tail === null ? head : ({ head, tail })

/** @type {<T>(list: List<T>) => NotLazy<T>} */
const trampoline = list => {
    while (typeof list === 'function') { list = list() }
    return list
}

/** @type {<T>(head: List<T>) => Result<T>} */
export const next = head => {
    /** @type {typeof head} */
    let tail = null
    while (true) {
        head = trampoline(head)

        if (head instanceof Array) {
            head = fromArrayLike(head)
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
export const iterable = list => ({
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
export const toArray = list => {
    const u = trampoline(list)
    return u instanceof Array ? u : from(iterable(u))
}

/** @type {<I, O>(f: (n: NonEmpty<I>) => List<O>) => (input: List<I>) => Thunk<O>} */
const apply = f => input => () => {
    const n = next(input)
    return n === null ? null : f(n)
}

/** @type {<T>({ first, tail }: NonEmpty<List<T>>) => List<T>} */
const flatStep =
    ({ first, tail }) =>
    concat(first)(flat(tail))

/** @type {<T>(list: List<List<T>>) => Thunk<T>} */
export const flat = apply(flatStep)

/** @type {<I, O>(f: (value: I) => O) => (x: NonEmpty<I>) => List<O>} */
const mapStep = f => ({ first, tail }) =>
    ({ first: f(first), tail: map(f)(tail) })

/** @type {<I, O>(f: (value: I) => O) => (input: List<I>) => Thunk<O>} */
export const map = f => apply(mapStep(f))

/** @type {<I, O>(f: (value: I) => List<O>) => (input: List<I>) => Thunk<O>} */
export const flatMap = f => compose(map(f))(flat)

/** @type {<T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>} */
const filterStep = f => ({ first, tail }) => {
    const newTail = filter(f)(tail)
    return f(first) ? { first, tail: newTail } : newTail
}

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>} */
export const filter = f => apply(filterStep(f))

/** @type {<I, O>(f: (value: I) => O | null) => (n: NonEmpty<I>) => List<O>} */
const filterMapStep = f => n => {
    const [first, tail] = [f(n.first), filterMap(f)(n.tail)]
    return first === null ? tail : { first, tail }
}

/** @type {<I, O>(f: (value: I) => O | null) => (input: List<I>) => Thunk<O>} */
export const filterMap = f => apply(filterMapStep(f))

/** @type {<T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>} */
const takeWhileStep
    = f => ({ first, tail }) => f(first) ? { first, tail: takeWhile(f)(tail) } : null

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>} */
export const takeWhile
    = f => apply(takeWhileStep(f))

/** @type {(n: number) => <T>(result: NonEmpty<T>) => List<T>} */
const takeStep = n => ({ first, tail }) =>
    0 < n ? { first: first, tail: take(n - 1)(tail) } : null

/** @type {(n: number) => <T>(input: List<T>) => Thunk<T>} */
export const take = n => apply(takeStep(n))

/** @type {<T>(f: (value: T) => boolean) => (ne: NonEmpty<T>) => List<T>} */
const dropWhileStep = f => ne => f(ne.first) ? dropWhile(f)(ne.tail) : ne

/** @type {<T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>} */
export const dropWhile = f => apply(dropWhileStep(f))

/** @type {(n: number) => <T>(ne: NonEmpty<T>) => List<T>} */
const dropStep = n => ne => 0 < n ? drop(n - 1)(ne.tail) : ne

/** @type {(n: number) => <T>(input: List<T>) => Thunk<T>} */
export const drop = n => apply(dropStep(n))

/** @type {<D>(def: D) => <T>(input: List<T>) => D | T} */
export const first = def => input => {
    const ne = next(input)
    return ne === null ? def : ne.first
}

/** @type {<D>(first: D) => <T>(tail: List<T>) => D | T} */
export const last = first => tail => {
    /** @typedef {typeof tail extends List<infer T> ? T : never} T */
    /** @type {NonEmpty<typeof first | T>} */
    let i = { first, tail }
    while (true) {
        const result = next(i.tail)
        if (result === null) {
            return i.first
        }
        i = result
    }
}

/** @type {<D>(def: D) => <T>(f: (value: T) => boolean) => (input: List<T>) => D | T} */
export const find = def => f => compose(filter(f))(first(def))

/** @type {(input: List<boolean>) => boolean} */
export const some = find(false)(identity)

/** @type {<T>(input: List<T>) => boolean} */
export const isEmpty = fn(map(() => true))
    .map(some)
    .map(logicalNot)
    .result

/** @type {(_: List<boolean>) => boolean} */
export const every = fn(map(logicalNot))
    .map(some)
    .map(logicalNot)
    .result

/** @type {<T>(value: T) => (sequence: List<T>) => boolean} */
export const includes = value =>
    compose(map(strictEqual(value)))(some)

/** @type {(count: number) => Thunk<number>} */
export const countdown = count => () => {
    if (count <= 0) { return null }
    const first = count - 1
    return { first, tail: countdown(first) }
}

/** @type {<T>(v: T) => (c: number) => Thunk<T>} */
export const repeat = v => compose(countdown)(map(() => v))

/** @type {<T>(list: List<T>) => List<T>} */
export const cycle = list => () => {
    const i = next(list)
    return i === null ? null : { first: i.first, tail: concat(i.tail)(cycle(list)) }
}

/** @type {<I, O>(op: Scan<I, O>) => (ne: NonEmpty<I>) => List<O>} */
const scanStep = op => ne => {
    const [first, newOp] = op(ne.first)
    return { first, tail: scan(newOp)(ne.tail) }
}

/** @type {<I, O>(op: Scan<I, O>) => (input: List<I>) => Thunk<O>} */
export const scan = op => apply(scanStep(op))

/** @type {<I, S, O>(op: StateScan<I, S, O>) => (init: S) => (input: List<I>) => Thunk<O>} */
export const stateScan = op => compose(stateScanToScan(op))(scan)

/** @type {<I, O>(op: Fold<I, O>) => (init: O) => (input: List<I>) => Thunk<O>} */
export const foldScan = op => compose(foldToScan(op))(scan)

/** @type {<I, O>(op: Fold<I, O>) => (init: O) => (input: List<I>) => O} */
export const fold = op => init => compose(foldScan(op)(init))(last(init))

/** @type {<T>(op: Reduce<T>) => <D>(def: D) => (input: List<T>) => D | T} */
export const reduce = op => def => compose(scan(reduceToScan(op)))(last(def))

/**
 * A fold that can bail out early, packaged as plain data.
 *
 * `init` is the starting state, `update` advances the state by one item and
 * returns `null` to abort the whole fold, and `end` finalizes the surviving
 * state into a result. Keeping the three parts together lets `tryFold` drive
 * any short-circuiting accumulation without knowing its domain.
 *
 * @template I
 * @template T
 * @template R
 * @typedef {{
 *  readonly init: T
 *  readonly update: (i: I, state: T) => Nullable<T>
 *  readonly end: (state: T) => R
 * }} Accumulator
 */

/**
 * Folds `input` with an {@link Accumulator}, short-circuiting to `null` the
 * moment `update` rejects an item; otherwise finalizes with `end`. This is the
 * list-level `try*` sibling of {@link fold} for accumulations that can fail
 * partway through (see the `try*`/`Nullable` convention in `AGENTS.md`).
 *
 * @type {<I, T, R>({ init, update, end }: Accumulator<I, T, R>) => (input: List<I>) => Nullable<R>}
 */
export const tryFold = ({ init, update, end }) => input => {
    let state = init
    for (const i of iterable(input)) {
        const candidate = update(i, state)
        if (candidate === null) { return null }
        state = candidate
    }
    return end(state)
}

/** @type {<T>(list: List<T>) => Thunk<number>} */
const lengthList = list => () => {
    const notLazy = trampoline(list)
    if (notLazy === null) { return null }
    if (notLazy instanceof Array) { return [notLazy.length] }
    const tail = lengthList(notLazy.tail)
    if ('first' in notLazy) {
        return { first: 1, tail }
    }
    return { head: lengthList(notLazy.head), tail }
}

const sum = reduce(addition)(0)

/** @type {<T>(input: List<T>) => number} */
export const length = input => sum(lengthList(input))

/**
 * @template T
 * @typedef {readonly [number, T]} Entry
 */

/** @type {<T>(value: T, index: number) => readonly [Entry<T>, number]} */
const entryOperator = (value, index) => [[index, value], index + 1]

/** @type {<T>(input: List<T>) => Thunk<Entry<T>>} */
export const entries = input => {
    /** @typedef {typeof input extends List<infer T> ? T : never} T */
    /** @type {StateScan<T, number, Entry<T>>} */
    const o = entryOperator
    return stateScan(o)(0)(input)
}

/** @type {<T>(value: T) => (prior: List<T>) => List<T>} */
const reverseOperator = first => tail => ({ first, tail })

/** @type {<T>(input: List<T>) => List<T>} */
export const reverse = fold(reverseOperator)(null)

/** @type {<A>(a: List<A>) => <B>(b: List<B>) => Thunk<readonly [A, B]>} */
export const zip = a => b => () => {
    const aResult = next(a)
    if (aResult === null) { return null }
    const bResult = next(b)
    if (bResult === null) { return null }
    return { first: [aResult.first, bResult.first], tail: zip(aResult.tail)(bResult.tail) }
}

/** @type {<T>(e: Equal<T>) => (a: List<T>) => (b: List<T>) => boolean} */
export const equal = e => {
    /** @typedef {typeof e extends Equal<infer T> ? T : never} T */
    /** @type {(a: List<T>) => (b: List<T>) => List<boolean>} */
    const f = a => b => () => {
        const [aResult, bResult] = [next(a), next(b)]
        return aResult === null || bResult === null
            ? { first: aResult === bResult, tail: null }
            : { first: e(aResult.first)(bResult.first), tail: f(aResult.tail)(bResult.tail) }
    }
    return a => b => every(f(a)(b))
}

export const empty = null
