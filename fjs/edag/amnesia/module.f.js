/**
 * Interpret EDAG without remembering newly evaluated nodes. Every incoming
 * edge evaluates its target again, except exact nodes the caller established.
 * Represented function invocations start with no established nodes. A call
 * in tail position of a body is made in the invocation's place.
 *
 * @module
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Context } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { invokerWith, operation } from '../operations/module.f.js'
import { settle } from '../value/call/module.f.js'

/** An expression in tail position: its value, or the call it leaves. @type {(context: Context, invoke: Invoke) => (e: Exp) => Outcome} */
const outcome = (context, invoke) => {
    const { memo } = context
    const settled = settle(invoke)
    /** @type {(e: Exp) => Outcome} */
    const last = e => {
        if (!isArray(e)) { return ok(e) }
        const established = memo?.find(([node]) => node === e)
        if (established !== undefined) { return ok(established[1]) }
        const run = operation({
            context,
            operand: (e, state) => [state, settled(last(e))],
            tail: (e, state) => [state, last(e)],
            expression: e => e,
            invoke,
        })
        return run(e, null)[1]
    }
    return last
}

/**
 * The invoker of an executor given `runtime`, its closure bodies walked
 * afresh under each invocation's context ({@link invokerWith}).
 *
 * @type {(runtime: Runtime | undefined) => Invoke}
 */
export const invokeWith = runtime => invokerWith((fn, context) => outcome(context, invokeWith(context.runtime))(fn[3]))(runtime)

/** {@link invokeWith} no runtime: every member function it answers is one the dispatcher implements natively. @type {Invoke} */
export const invoke = invokeWith(undefined)

/** @type {(context: Context) => (e: Exp) => ValueResult} */
export const vm = context => {
    const invoke = invokeWith(context.runtime)
    const last = outcome(context, invoke)
    const settled = settle(invoke)
    return e => settled(last(e))
}
