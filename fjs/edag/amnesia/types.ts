import type { Exp } from '../types.ts'
import type { Array, EdagValue, Function, Values } from '../value/types.ts'

/**
 * What an invocation holds: the captured frame and the arguments, and the
 * nodes the caller established, if any.
 */
export type Context = {
    readonly frame: Values,
    readonly args: Values,
    readonly fixed?: Values,
    readonly rest?: Array,
    /** The function being invoked, what its body's `['self']` reads; absent at a module's scope. */
    readonly self?: Function,
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
    readonly memo?: readonly (readonly [Exp, EdagValue])[],
}
