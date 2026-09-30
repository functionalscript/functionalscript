import type { Exp, TagMap } from '../types.ts'
import type { Callable } from '../../types/function/length/types.ts'

/**
 * What an invocation holds: the captured frame and the arguments, and the
 * nodes the caller established, if any.
 */
export type Context = {
    readonly frame: unknown,
    readonly args: readonly unknown[],
    readonly fixed?: readonly unknown[] | undefined,
    readonly rest?: readonly unknown[] | undefined,
    /**
     * Nodes whose values the caller already established, consulted by node
     * identity before anything is computed — `../execution-models.md`'s
     * §2.2, "memoize only shared nodes", in the form where the caller did the
     * analysis. Absent is the model this evaluator is named for: nothing
     * remembered, every incoming edge walked again.
     *
     * A caller that supplies one owes the order: an entry may only be built
     * from entries before it, since this is consulted and never extended.
     */
    readonly memo?: readonly (readonly [Exp, unknown])[],
    /**
     * The function value a `=>` node makes (`Evaluator`'s `withText` in
     * `../operations/types.ts`). Unlike `memo`, it crosses into every
     * invocation: it is how this evaluator makes functions, not what one
     * invocation established.
     */
    readonly withText?: ((f: Callable, node: TagMap['=>']) => unknown) | undefined,
}
