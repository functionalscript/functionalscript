/**
 * A tree-walking evaluator for `exp`: `vm(context)(e)` returns a primitive
 * unchanged and runs a tagged tuple through its operation in
 * [`../operations`](../operations/module.f.mjs), with every operand
 * evaluated by recursion.
 *
 * It remembers no node values of its own — every incoming edge evaluates its
 * target again — so it is the Amnesia model of
 * [execution-models.md](../execution-models.md), for proving semantics and
 * not for running FunctionalScript. A caller that has established some nodes
 * itself may hand them over as `Context`'s `memo`, which is the one thing
 * this walk does not recompute. See [README.md](./README.md).
 *
 * @module
 *
 * @import { Exp } from '../types.ts'
 * @import { Context } from './types.ts'
 */

import { operation } from '../operations/module.f.mjs'

/** @type {(context: Context) => (e: Exp) => unknown} */
export const vm = context => {
    const { frame, args, fixed, rest, memo } = context
    // The body is a new invocation, so it starts with nothing established:
    // the enclosing `memo` does not cross the boundary, the same way the
    // model's per-invocation memo does not.
    const run = operation({ frame, args, fixed, rest, operand: e => f(e), invoke: (frame, fixed, rest, body) => vm({ frame, args: [], fixed, rest })(body) })
    /** @type {(e: Exp) => unknown} */
    const f = e => {
        if (!(e instanceof Array)) { return e }
        // By identity, and before dispatch: an established node is a value
        // this walk does not recompute, which is the only way one node
        // reached twice can be one object here. `find` and not a `Map`
        // because a caller supplies the few nodes it knows are shared.
        const established = memo?.find(([n]) => n === e)
        return established === undefined ? run(e) : established[1]
    }
    return f
}
