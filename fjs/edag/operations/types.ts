/**
 * Type-level API of the EDAG operations: what an executor supplies to run
 * one node, and the table of operations it runs it through.
 *
 * @module
 */

import type { ExpOp, Over, TagMap } from '../types.ts'

/**
 * The mark every closure carries: one object the operations module holds,
 * compared by identity, so that no object a program builds is a closure.
 */
export type Mark = { readonly closure: true }

/**
 * A function value: the graph's closure as data, not a host function. `E`
 * is the executor's operand form, which the body is in — a node for
 * amnesia, an entry reference for memo — and `frame` is the captured value.
 * `length` is the one property a program reads off it. A call of one is
 * the executor's `call`, never a JavaScript call.
 */
export type Closure<E> = {
    readonly mark: Mark
    readonly length: number
    readonly frame: unknown
    readonly body: E
}

/**
 * How an executor evaluates: `operand` is the value of an operand — by
 * recursion in [amnesia](../amnesia/README.md), by a lookup in an executor
 * over the analysis table — `invoke` starts a new invocation of a function
 * body over its frame and arguments, and `frame` and `args` are this
 * invocation's. A lazy operand is evaluated through `operand` only when it
 * is demanded, so `&&`, `||`, `??` and `?:` short-circuit under any
 * executor.
 */
export type Evaluator<E> = {
    readonly frame: unknown
    readonly args: readonly unknown[]
    readonly operand: (e: E) => unknown
    readonly invoke: (frame: unknown, args: readonly unknown[], body: E) => unknown
}

/** One operation per tag, each over the node kind of that tag with `E` as its operands. */
export type Operations = {
    readonly [K in ExpOp[0]]: <E>(x: Evaluator<E>) => (e: Over<TagMap[K], E>) => unknown
}
