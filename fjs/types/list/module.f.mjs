/**
 * Immutable list data structure utilities and combinators.
 *
 * @module
 *
 * @import { Nullable } from '../nullable/types.ts'
 * @import {Binary, Scan, StateScan, Fold, Reduce, Equal, Step, Transduced, Transducer} from '../function/operator/types.ts'
 * @import { Accumulator, Indexed, List, NonEmpty, NotLazy, Result, Thunk } from './types.ts'
 */

import { identity, compose } from '../function/module.f.js'
import { hasEntry } from '../object/entry/module.f.js'
import {
    addition,
    logicalNot,
    strictEqual,
    stateScanToScan,
    foldToScan,
    reduceToScan,
    nextStep,
    doneStep,
} from '../function/operator/module.f.js'
import { assert, assertNotNullish } from '../../asserts/module.f.js'

export const fromArrayLike =
    /**
     * @template T
     * @param {ArrayLike<T>} array
     * @result {Result<T>}
     */
    array => {
        /** @type {(i: number) => Result<T>} */
        const at = i =>
            i < array.length ? { first: array[Number(i)], tail: () => at(i + 1) } : null
        return at(0)
    }

/** @type {<T>(head: List<T>) => (tail: List<T>) => List<T>} */
export const concat = head => tail =>
    tail === null ? head : ({ head, tail })

/** @type {<T>(list: List<T>) => NotLazy<T>} */
export const trampoline = list => {
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
            tail = concat(head.tail)(tail)
            head = head.head
            continue
        }

        if (head !== null) {
            return { first: head.first, tail: concat(head.tail)(tail) }
        }

        if (tail === null) { return null }

        head = tail
        tail = null
    }
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

/**
 * `sep` between every two adjacent items, and nowhere else: `a, b, c`
 * becomes `a, sep, b, sep, c`.
 *
 * @type {<S>(sep: S) => <T>(input: List<T>) => Thunk<T | S>}
 */
export const intersperse = sep => apply(({ first, tail }) =>
    ({ first, tail: flatMap(i => [sep, i])(tail) }))

/** @type {<T>(join: Binary<T, T, Nullable<T>>) => (first: T) => (tail: List<T>) => Thunk<T>} */
const mergeFrom = join => first => tail => () => {
    const n = next(tail)
    if (n === null) { return [first] }
    const merged = join(first)(n.first)
    return merged === null
        ? { first, tail: mergeFrom(join)(n.first)(n.tail) }
        : mergeFrom(join)(merged)(n.tail)
}

/**
 * Every run of adjacent items `join` accepts, folded into one. `join(a)(b)`
 * is the item that replaces `a` followed by `b`, or `null` when the two stay
 * apart; a merged item is joined again with the one after it.
 *
 * @type {<T>(join: Binary<T, T, Nullable<T>>) => (input: List<T>) => Thunk<T>}
 */
export const mergeAdjacent = join => apply(({ first, tail }) => mergeFrom(join)(first)(tail))

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

/**
 * The first answer `f` gives for an item of `input` that is not `null`, or
 * `null` when it gives none. `filterMap` drops the `null`s lazily, so `f` is
 * not called past the first answer.
 *
 * [`fjs/types/array`](../array/module.f.mjs)'s `findMap` is the same over an
 * array, for a recursive walk that cannot spend the frames a lazy list takes.
 *
 * @type {<I, O>(f: (value: I) => O | null) => (input: List<I>) => O | null}
 */
export const findMap = f => compose(filterMap(f))(first(null))

/** @type {(input: List<boolean>) => boolean} */
export const some = find(false)(identity)

/** Whether some element satisfies `p`. @type {<T>(p: (value: T) => boolean) => (input: List<T>) => boolean} */
export const someBy = p => compose(map(p))(some)

/** Whether no element satisfies `p`. @type {<T>(p: (value: T) => boolean) => (input: List<T>) => boolean} */
export const none = p => compose(someBy(p))(logicalNot)

/** @type {<T>(input: List<T>) => boolean} */
export const isEmpty = none(() => true)

/** @type {(_: List<boolean>) => boolean} */
export const every = none(logicalNot)

/** @type {<T>(value: T) => (sequence: List<T>) => boolean} */
export const includes = value => someBy(strictEqual(value))

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

/** @type {<I, S, O, A>(machine: Transducer<I, S, O, A>, input: List<I>, current: Step<S, O, A>) => Thunk<Transduced<O, A>>} */
const transduceFrom = (machine, input, current) => () => {
    let remaining = input
    let step = current
    while (true) {
        const [tag, output, state] = step
        if (tag === 'done') { return [step] }
        if (output.length !== 0) {
            return {
                first: ['next', output],
                tail: transduceFrom(machine, remaining, nextStep(state)),
            }
        }
        const node = next(remaining)
        if (node === null) { return [machine.end(state)] }
        step = machine.update(state, node.first)
        remaining = node.tail
    }
}

/**
 * Drives a machine lazily, yielding its nonempty output chunks followed by one
 * terminal chunk and summary. Initial output is emitted before reading input;
 * an initial or updated `done` never pulls the source again. EOF calls `end`,
 * whose flush output is kept on the terminal event. Empty chunks do not signal
 * EOF, and skipping updates that emit nothing uses a loop rather than recursion.
 *
 * Output alone is `flat(map(([, output]) => output)(transduce(machine)(input)))`.
 * Reading that view and the summary separately reruns the pure source, like any
 * other lazy list; consumers needing both should read the events once.
 *
 * @type {<I, S, O, A>(machine: Transducer<I, S, O, A>) => (input: List<I>) => Thunk<Transduced<O, A>>}
 */
export const transduce = machine => input => transduceFrom(machine, input, machine.init)

const lastEvent = last(null)

/**
 * Runs a machine to its terminal summary without holding its emitted chunks.
 * Use {@link transduce} when the outputs are wanted as they arrive.
 *
 * @type {<I, S, O, A>(machine: Transducer<I, S, O, A>) => (input: List<I>) => A}
 */
export const run = machine => {
    const events = transduce(machine)
    return input => {
        const [tag, , summary] = assertNotNullish(lastEvent(events(input)))
        assert(tag === 'done')
        return summary
    }
}

const rejected = doneStep(null)

/**
 * The small `Accumulator` convenience form as a canonical machine. Rejection
 * becomes early completion with a `null` summary; state and result values can
 * themselves be `null` without being confused with the lifecycle tag.
 *
 * @type {<I, T, R>(accumulator: Accumulator<I, T, R>) => Transducer<I, T, never, Nullable<R>>}
 */
export const fromAccumulator = ({ init, update, end }) => ({
    init: nextStep(init),
    update: (state, input) => {
        const following = update(input, state)
        return following === null ? rejected : nextStep(following)
    },
    end: state => doneStep(end(state)),
})

/**
 * Folds with the `Accumulator` convenience form through the shared machine
 * driver. Rejection stops reading immediately and answers `null`; EOF returns
 * its final result (the list-level `try*`/`Nullable` convention).
 *
 * @type {<I, T, R>(accumulator: Accumulator<I, T, R>) => (input: List<I>) => Nullable<R>}
 */
export const tryFold = accumulator => run(fromAccumulator(accumulator))

/** @type {<T>(list: List<T>) => Thunk<number>} */
const lengthList = list => () => {
    const notLazy = trampoline(list)
    if (notLazy === null) { return null }
    if (notLazy instanceof Array) { return [notLazy.length] }
    const tail = lengthList(notLazy.tail)
    if (hasEntry(notLazy, 'first')) {
        return { first: 1, tail }
    }
    return { head: lengthList(notLazy.head), tail }
}

const sum = reduce(addition)(0)

/** @type {<T>(input: List<T>) => number} */
export const length = input => sum(lengthList(input))

/** @type {<T>(value: T, index: number) => readonly [Indexed<T>, number]} */
const entryOperator = (value, index) => [[index, value], index + 1]

/** @type {<T>(input: List<T>) => Thunk<Indexed<T>>} */
export const entries = input => {
    /** @typedef {typeof input extends List<infer T> ? T : never} T */
    /** @type {StateScan<T, number, Indexed<T>>} */
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

/**
 * Whether two lists hold the same items, in the same order, compared with
 * `===`: {@link equal} over `strictEqual`. It stops at the first item that
 * differs, and materialises neither list to get there.
 *
 * @type {<T>(a: List<T>) => (b: List<T>) => boolean}
 */
export const sameItems = equal(strictEqual)

export const empty = null
