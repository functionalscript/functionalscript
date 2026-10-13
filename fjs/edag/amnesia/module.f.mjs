/**
 * Interpret EDAG without remembering newly evaluated nodes. Every incoming
 * edge evaluates its target again, except exact nodes the caller established.
 * Represented function invocations start with no established nodes.
 *
 * @module
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Context } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { entryCall, operation } from '../operations/module.f.mjs'

/**
 * The invoker of an executor given `runtime`: a represented function
 * invoked, its body walked afresh under the same runtime — or the `entry`
 * helper, answered in place.
 *
 * @type {(runtime: Runtime | undefined) => Invoke}
 */
export const invoker = runtime => {
    /** @type {Invoke} */
    const invoke = (fn, fixed, rest) => fn[0] === 'entry'
        ? entryCall(fixed, invoke)
        : vm({ frame: fn[2], args: [], fixed, rest, self: fn, runtime })(fn[3])
    return invoke
}

/** {@link invoker} with no runtime: every member function it answers is one the dispatcher implements natively. @type {Invoke} */
export const invoke = invoker(undefined)

/** @type {(context: Context) => (e: Exp) => ValueResult} */
export const vm = context => {
    const { memo, runtime } = context
    const run = operation({ context, operand: (e, state) => [state, evaluate(e)], expression: e => e, invoke: invoker(runtime) })
    /** @type {(e: Exp) => ValueResult} */
    const evaluate = e => {
        if (!isArray(e)) { return ok(e) }
        const established = memo?.find(([node]) => node === e)
        return established === undefined ? run(e, null)[1] : ok(established[1])
    }
    return evaluate
}
