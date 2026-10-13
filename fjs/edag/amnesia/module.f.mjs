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
 * @import { Context } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { ok } from '../../types/result/module.f.js'
import { entryCall, operation } from '../operations/module.f.mjs'
import { invoker, settle } from '../value/call/module.f.mjs'

/** A body walked afresh — or the `entry` helper, answered in place. @type {Body} */
const body = (fn, fixed, rest) => fn[0] === 'entry'
    ? entryCall(fixed, invoke)
    : outcome({ frame: fn[2], args: [], fixed, rest, self: fn })(fn[3])

/** A represented function invoked: its body, and every call the body leaves in tail position, made in its place. @type {Invoke} */
export const invoke = invoker(body)

const settled = settle(invoke)

/** An expression in tail position: its value, or the call it leaves. @type {(context: Context) => (e: Exp) => Outcome} */
const outcome = context => {
    const { memo } = context
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
    return e => settled(last(e))
}
