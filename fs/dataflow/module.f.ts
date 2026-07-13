/**
 * Dataflow graphs over sequences with deferred input binding.
 *
 * A {@link Node} describes a computation producing a sequence of `O` as an
 * immutable graph, without binding its external inputs. Inputs are read from
 * an environment of type `E` that is supplied later, when an engine runs the
 * graph, so the same graph can be bound to different data — and, in the
 * future, run by different engines (memoizing, streaming, distributed).
 *
 * Primitive node kinds — the only ones an engine has to interpret:
 *
 * - {@link input} — a deferred external input, read from the environment,
 * - {@link flatMap} — a stateless stage: zero or more outputs per element,
 * - {@link scan} — a stateful stage: exactly one output per element,
 * - {@link fold} — the only stage that observes the end of its source:
 *   emits a single final value.
 *
 * Everything else ({@link map}, {@link filter}, {@link last},
 * {@link reduce}) is derived from the primitives. {@link run} is the
 * simplest engine: it binds the graph directly to `types/list` operations.
 *
 * See [todo/dataflow.md](../../todo/dataflow.md) for the design and the
 * planned extensions (engine interface, RTTI-typed inputs, unordered
 * collection kinds).
 *
 * @module
 */
import {
    type List,
    flatMap as listFlatMap,
    scan as listScan,
    fold as listFold,
} from '../types/list/module.f.ts'
import {
    type Scan,
    type Fold,
    type Reduce,
    reduceToScan,
} from '../types/function/operator/module.f.ts'
import { identity } from '../types/function/module.f.ts'

type InputNode<E, O> = {
    readonly kind: 'input'
    readonly get: (env: E) => List<O>
}

/**
 * Non-input nodes hide the element type `I` of their source — an
 * existential type. TypeScript has no existentials, so each node carries an
 * `unpack` function that reintroduces `I` as a type parameter of the given
 * `match` continuation. Engines destructure a node with
 * `node.unpack(f => source => ...)` and stay fully typed, without casts.
 */
type FlatMapNode<E, O> = {
    readonly kind: 'flatMap'
    readonly unpack: <R>(
        match: <I>(f: (value: I) => List<O>) => (source: Node<E, I>) => R
    ) => R
}

type ScanNode<E, O> = {
    readonly kind: 'scan'
    readonly unpack: <R>(
        match: <I>(op: Scan<I, O>) => (source: Node<E, I>) => R
    ) => R
}

type FoldNode<E, O> = {
    readonly kind: 'fold'
    readonly unpack: <R>(
        match: <I>(op: Fold<I, O>) => (init: O) => (source: Node<E, I>) => R
    ) => R
}

/**
 * A node of a dataflow graph: a deferred sequence of `O` computed from an
 * environment of type `E`.
 *
 * The environment is the input schema of the graph: every external input is
 * a field of `E`, so binding inputs is type-checked by TypeScript.
 */
export type Node<E, O> = |
    InputNode<E, O> |
    FlatMapNode<E, O> |
    ScanNode<E, O> |
    FoldNode<E, O>

/**
 * A deferred external input, read from the environment when the graph runs.
 *
 * @example
 *
 * ```ts
 * type Env = { readonly text: List<string> }
 * const text: Node<Env, string> = input(env => env.text)
 * ```
 */
export const input = <E, O>(get: (env: E) => List<O>): Node<E, O> =>
    ({ kind: 'input', get })

/**
 * A stateless stage: `f` maps every element of the source to zero or more
 * output elements.
 */
export const flatMap = <I, O>(f: (value: I) => List<O>) =>
    <E>(source: Node<E, I>): Node<E, O> => ({
        kind: 'flatMap',
        unpack: match => match(f)(source),
    })

/**
 * A stateful stage: `op` maps every element of the source to exactly one
 * output element and the operator for the rest of the sequence.
 *
 * Stateful operators of other shapes convert to `Scan` with
 * `stateScanToScan` and `foldToScan` from the operator module.
 */
export const scan = <I, O>(op: Scan<I, O>) =>
    <E>(source: Node<E, I>): Node<E, O> => ({
        kind: 'scan',
        unpack: match => match(op)(source),
    })

/**
 * Folds the whole source into a single final value: the output is a
 * one-element sequence, `init` when the source is empty. The only primitive
 * that observes the end of its source.
 */
export const fold = <I, O>(op: Fold<I, O>) => (init: O) =>
    <E>(source: Node<E, I>): Node<E, O> => ({
        kind: 'fold',
        unpack: match => match(op)(init)(source),
    })

const mapStep = <I, O>(f: (value: I) => O) => (value: I): List<O> =>
    [f(value)]

/** Maps every element of the source with `f`. Derived from `flatMap`. */
export const map = <I, O>(f: (value: I) => O)
    : <E>(source: Node<E, I>) => Node<E, O> =>
    flatMap(mapStep(f))

const filterStep = <T>(p: (value: T) => boolean) => (value: T): List<T> =>
    p(value) ? [value] : null

/** Keeps the elements for which `p` holds. Derived from `flatMap`. */
export const filter = <T>(p: (value: T) => boolean)
    : <E>(source: Node<E, T>) => Node<E, T> =>
    flatMap(filterStep(p))

const lastStep = <T>(value: T) => (_: List<T>): List<T> =>
    [value]

/**
 * The last element of the source, or an empty sequence when the source is
 * empty. Derived from `fold` into a 0/1-element `List` accumulator,
 * flattened with `flatMap`.
 */
export const last = <E, T>(source: Node<E, T>): Node<E, T> =>
    flatMap<List<T>, T>(identity)(fold<T, List<T>>(lastStep)(null)(source))

/**
 * Folds the source with `op` without an initial value: a one-element
 * sequence with the result, or an empty sequence when the source is empty.
 * Derived from `scan` and `last`.
 */
export const reduce = <T>(op: Reduce<T>)
    : <E>(source: Node<E, T>) => Node<E, T> => {
    const scanOp = scan(reduceToScan(op))
    return source => last(scanOp(source))
}

const runFlatMap = <E>(env: E) => <O, I>(f: (value: I) => List<O>) =>
    (source: Node<E, I>): List<O> =>
        listFlatMap(f)(run(env)(source))

const runScan = <E>(env: E) => <O, I>(op: Scan<I, O>) =>
    (source: Node<E, I>): List<O> =>
        listScan(op)(run(env)(source))

const runFold = <E>(env: E) => <O, I>(op: Fold<I, O>) => (init: O) =>
    (source: Node<E, I>): List<O> =>
        [listFold(op)(init)(run(env)(source))]

/**
 * The naive engine: binds the graph to the given environment and runs it
 * directly on `types/list` operations. A node referenced by several
 * consumers is recomputed for each of them; see
 * [todo/dataflow.md](../../todo/dataflow.md) for planned smarter engines.
 */
export const run = <E>(env: E) => <O>(node: Node<E, O>): List<O> => {
    switch (node.kind) {
        case 'input':
            return node.get(env)
        case 'flatMap':
            return node.unpack<List<O>>(runFlatMap(env))
        case 'scan':
            return node.unpack<List<O>>(runScan(env))
        case 'fold':
            return node.unpack<List<O>>(runFold(env))
    }
}
