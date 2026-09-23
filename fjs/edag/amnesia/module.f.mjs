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
 * @import { Closure } from '../operations/types.ts'
 * @import { Context } from './types.ts'
 */

import { operation } from '../operations/module.f.mjs'

/**
 * A call of a closure this evaluator built: a new invocation of the body
 * over the captured frame and the arguments, with nothing established —
 * the caller's `memo` does not cross the boundary, the same way the
 * model's per-invocation memo does not. This is the one way to call a
 * function value, since it is a record and not a host function.
 *
 * @type {(closure: Pick<Closure<Exp>, 'frame' | 'body'>) => (args: readonly unknown[]) => unknown}
 */
export const call = ({ frame, body }) => args => vm({ frame, args })(body)

/** @type {(context: Context) => (e: Exp) => unknown} */
export const vm = context => {
    const { frame, args, memo } = context
    const run = operation({ frame, args, operand: e => f(e), invoke: (frame, args, body) => call({ frame, body })(args) })
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
