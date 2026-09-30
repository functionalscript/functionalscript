/**
 * Type-level API of the EDAG operations: what an executor supplies to run
 * one node, and the table of operations it runs it through.
 *
 * @module
 */

import type { ExpOp, Over, TagMap } from '../types.ts'
import type { Callable } from '../../types/function/length/types.ts'

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
    readonly fixed?: readonly unknown[] | undefined
    readonly rest?: readonly unknown[] | undefined
    readonly operand: (e: E) => unknown
    readonly invoke: (frame: unknown, fixed: readonly unknown[], rest: readonly unknown[], body: E) => unknown
    /**
     * The function value a `=>` node makes, from the callable and the node.
     * Absent, it is the callable, whose `String` is the factory's source
     * rather than the node's text; the host supplies one that answers the
     * text (`fjs/types/function/text`), which FunctionalScript cannot.
     */
    readonly withText?: ((f: Callable, node: Over<TagMap['=>'], E>) => unknown) | undefined
}

/** One operation per tag, each over the node kind of that tag with `E` as its operands. */
export type Operations = {
    readonly [K in ExpOp[0]]: <E>(x: Evaluator<E>) => (e: Over<TagMap[K], E>) => unknown
}
