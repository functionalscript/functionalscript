import * as function_ from '../function/module.f.ts'
const { identity, fn, compose } = function_
import * as operator from '../function/operator/module.f.mjs'
const {
    addition,
    logicalNot,
    strictEqual,
    stateScanToScan,
    foldToScan,
    reduceToScan
} = operator

export type List<T> = NotLazy<T> | Thunk<T>

type NotLazy<T> = |
    Result<T> |
    Concat<T> |
    readonly T[]

type Empty = null

export type Result<T> = Empty | NonEmpty<T>

export type Thunk<T> = () => List<T>

type NonEmpty<T> = {
    readonly first: T
    readonly tail: List<T>
}

type Concat<T> = {
    readonly head: List<T>
    readonly tail: List<T>
}

const fromArray
: <T>(array: readonly T[]) => Result<T>
= array => {
    type T = typeof array extends readonly (infer T)[] ? T : never
    const at
    : (i: number) => Result<T>
    = i => i < array.length ? { first: array[i], tail: () => at(i + 1) } : null
    return at(0)
}

export const concat
: <T>(head: List<T>) => (tail: List<T>) => List<T>
= head => tail => tail === null ? head : ({ head, tail })

const trampoline
: <T>(list: List<T>) => NotLazy<T>
= list => {
    while (typeof list === 'function') { list = list() }
    return list
}

export const next
: <T>(list: List<T>) => Result<T>
= head => {
    let tail: typeof head = null
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

export const iterable
: <T>(list: List<T>) => Iterable<T>
= list => ({
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

export const toArray
: <T>(list: List<T>) => readonly T[]
= list => {
    const u = trampoline(list)
    return u instanceof Array ? u : from(iterable(u))
}

const apply
: <I, O>(step: (n: NonEmpty<I>) => List<O>) => (input: List<I>) => Thunk<O>
= f => input => () => {
    const n = next(input)
    if (n === null) { return null }
    return f(n)
}

const flatStep
: <T>(n: NonEmpty<List<T>>) => List<T>
= ({ first, tail }) => concat(first)(flat(tail))

export const flat
: <T>(list: List<List<T>>) => Thunk<T>
= apply(flatStep)

const mapStep
: <I, O>(f: (value: I) => O) => (n: NonEmpty<I>) => List<O>
= f => ({ first, tail }) => ({ first: f(first), tail: map(f)(tail) })

export const map
: <I, O>(f: (value: I) => O) => (input: List<I>) => Thunk<O>
= f => apply(mapStep(f))

export const flatMap
: <I, O>(f: (value: I) => List<O>) => (input: List<I>) => Thunk<O>
= f => compose(map(f))(flat)

const filterStep
: <T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>
= f => ({ first, tail }) => {
    const newTail = filter(f)(tail)
    return f(first) ? { first, tail: newTail } : newTail
}

export const filter
: <T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>
= f => apply(filterStep(f))

const filterMapStep
: <I, O>(f: (value: I) => O|null) => (n: NonEmpty<I>) => List<O>
= f => n => {
    const [first, tail] = [f(n.first), filterMap(f)(n.tail)]
    return first === null ? tail : { first, tail }
}

export const filterMap
: <I, O>(f: (value: I) => O|null) => (input: List<I>) => Thunk<O>
= f => apply(filterMapStep(f))

const takeWhileStep
: <T>(f: (value: T) => boolean) => (n: NonEmpty<T>) => List<T>
= f => ({ first, tail }) => f(first) ? { first, tail: takeWhile(f)(tail) } : null

export const takeWhile
: <T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>
= f => apply(takeWhileStep(f))

const takeStep
: (n: number) => <T>(result: NonEmpty<T>) => List<T>
= n => ({ first, tail }) => 0 < n ? { first: first, tail: take(n - 1)(tail) } : null

export const take
: (n: number) => <T>(input: List<T>) => Thunk<T>
= n => apply(takeStep(n))

const dropWhileStep
: <T>(f: (value: T) => boolean) => (ne: NonEmpty<T>) => List<T>
= f => ne => f(ne.first) ? dropWhile(f)(ne.tail) : ne

export const dropWhile
: <T>(f: (value: T) => boolean) => (input: List<T>) => Thunk<T>
= f => apply(dropWhileStep(f))

const dropStep
: (n: number) => <T>(ne: NonEmpty<T>) => List<T>
= n => ne => 0 < n ? drop(n - 1)(ne.tail) : ne

export const drop
: (n: number) => <T>(input: List<T>) => Thunk<T>
= n => apply(dropStep(n))

export const first
: <D>(def: D) => <T>(input: List<T>) => D|T
= def => input => {
    const ne = next(input)
    return ne === null ? def : ne.first
}

export const last
: <D>(first: D) => <T>(tail: List<T>) => D|T
= first => tail => {
    type T = typeof tail extends List<infer T> ? T : never
    let i: NonEmpty<typeof first|T> = { first, tail }
    while (true) {
        const result = next(i.tail)
        if (result === null) {
            return i.first
        }
        i = result
    }
}

export const find
: <D>(def: D) => <T>(f: (value: T) => boolean) => (input: List<T>) => D|T
= def => f => compose(filter(f))(first(def))

export const some
: (input: List<boolean>) => boolean
= find(false)(identity)

export const isEmpty
: <T>(input: List<T>) => boolean
= fn(map(() => true))
    .then(some)
    .then(logicalNot)
    .result

export const every = fn(map(logicalNot))
    .then(some)
    .then(logicalNot)
    .result

export const includes
: <T>(value: T) => (sequence: List<T>) => boolean
= value => compose(map(strictEqual(value)))(some)

export const countdown
: (count: number) => Thunk<number>
= count => () => {
    if (count <= 0) { return null }
    const first = count - 1
    return { first, tail: countdown(first) }
}

export const repeat
: <T>(v: T) => (c: number) => Thunk<T>
= v => compose(countdown)(map(() => v))

export const cycle
: <T>(list: List<T>) => List<T>
= list => () => {
    const i = next(list)
    return i === null ? null : { first: i.first, tail: concat(i.tail)(cycle(list)) }
}

const scanStep
: <I, O>(op: operator.Scan<I, O>) => (ne: NonEmpty<I>) => List<O>
= op => ne => {
    const [first, newOp] = op(ne.first)
    return { first, tail: scan(newOp)(ne.tail) }
}

export const scan
: <I, O>(op: operator.Scan<I, O>) => (input: List<I>) => Thunk<O>
= op => apply(scanStep(op))

export const stateScan
: <I, S, O>(op: operator.StateScan<I, S, O>) => (init: S) => (input: List<I>) => Thunk<O>
= op => compose(stateScanToScan(op))(scan)

export const foldScan
: <I,O>(op: operator.Fold<I, O>) => (init: O) => (input: List<I>) => Thunk<O>
= op => compose(foldToScan(op))(scan)

export const fold
: <I,O>(op: operator.Fold<I, O>) => (init: O) => (input: List<I>) => O
= op => init => compose(foldScan(op)(init))(last(init))

export const reduce
: <T>(op: operator.Reduce<T>) => <D>(def: D) => (input: List<T>) => D|T
= op => def => compose(scan(reduceToScan(op)))(last(def))

const lengthList
: <T>(list: List<T>) => Thunk<number>
= list => () => {
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

export const length
: <T>(input: List<T>) => number
= input => sum(lengthList(input))

export type Entry<T> = readonly[number, T]

const entryOperator
: (index: number) => <T>(value: T) => readonly[Entry<T>, number]
= index => value => [[index, value], index + 1]

export const entries
: <T>(input: List<T>) => Thunk<Entry<T>>
= input => {
    type T = typeof input extends List<infer T> ? T : never
    const o
    : operator.StateScan<T, number, Entry<T>>
    = entryOperator
    return stateScan(o)(0)(input)
}

const reverseOperator
: <T>(value: T) => (prior: List<T>) => List<T>
= first => tail => ({ first, tail })

export const reverse
: <T>(input: List<T>) => List<T>
= fold(reverseOperator)(null)

export const zip
: <A>(a: List<A>) => <B>(b: List<B>) => Thunk<readonly[A, B]>
= a => b => () => {
    const aResult = next(a)
    if (aResult === null) { return null }
    const bResult = next(b)
    if (bResult === null) { return null }
    return { first: [aResult.first, bResult.first], tail: zip(aResult.tail)(bResult.tail) }
}

export const equal
: <T>(e: operator.Equal<T>) => (a: List<T>) => (b: List<T>) => boolean
= e => {
    type T = typeof e extends operator.Equal<infer T> ? T : never
    const f
    : (a: List<T>) => (b: List<T>) => List<boolean>
    = a => b => () => {
        const [aResult, bResult] = [next(a), next(b)]
        return aResult === null || bResult === null
            ? { first: aResult === bResult, tail: null }
            : { first: e(aResult.first)(bResult.first), tail: f(aResult.tail)(bResult.tail) }
    }
    return a => b => every(f(a)(b))
}

export const empty = null
