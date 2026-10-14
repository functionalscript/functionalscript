/**
 * Interpret EDAG without remembering newly evaluated nodes. Every incoming
 * edge evaluates its target again, except exact nodes the caller established.
 * Represented function invocations start with no established nodes. A call
 * in tail position of a body is made in the invocation's place.
 *
 * @module
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Body, Invoke, Outcome } from '../value/call/types.ts'
 * @import { Runtime } from '../value/types.ts'
 * @import { Context } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { entryCall, operation } from '../operations/module.f.mjs'
import { invoker, settle } from '../value/call/module.f.mjs'

/**
 * The invoker of an executor given `runtime`: a represented function
 * invoked — its body walked afresh under the same runtime, or the `entry`
 * helper answered in place — and every call the body leaves in tail
 * position, made in its place.
 *
 * @type {(runtime: Runtime | undefined) => Invoke}
 */
export const invokeWith = runtime => {
    /** @type {Body} */
    const body = (fn, fixed, rest) => fn[0] === 'entry'
        ? entryCall(fixed, invoke)
        : outcome({ frame: fn[2], args: [], fixed, rest, self: fn, runtime })(fn[3])
    const invoke = invoker(body)
    return invoke
}

/** {@link invokeWith} no runtime: every member function it answers is one the dispatcher implements natively. @type {Invoke} */
export const invoke = invokeWith(undefined)

/** An expression in tail position: its value, or the call it leaves. @type {(context: Context) => (e: Exp) => Outcome} */
const outcome = context => {
    const { memo, runtime } = context
    const invoke = invokeWith(runtime)
    const settled = settle(invoke)
    const run = operation({
        context,
        operand: (e, state) => [state, settled(last(e))],
        tail: (e, state) => [state, last(e)],
        expression: e => e,
        invoke,
    })
    /** @type {(e: Exp) => Outcome} */
    const last = e => {
        if (!isArray(e)) { return ok(e) }
        const established = memo?.find(([node]) => node === e)
        return established === undefined ? run(e, null)[1] : ok(established[1])
    }
    return last
}

/** @type {(context: Context) => (e: Exp) => ValueResult} */
export const vm = context => {
    const last = outcome(context)
    const settled = settle(invokeWith(context.runtime))
    return e => settled(last(e))
}
