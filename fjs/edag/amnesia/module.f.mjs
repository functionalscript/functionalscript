/**
 * Interpret EDAG without remembering newly evaluated nodes. Every incoming
 * edge evaluates its target again, except exact nodes the caller established.
 * Represented function invocations start with no established nodes.
 *
 * @module
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke } from '../value/call/types.ts'
 * @import { Context } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.mjs'
import { ok } from '../../types/result/module.f.mjs'
import { entryCall, operation } from '../operations/module.f.mjs'

/** A represented function invoked, its body walked afresh — or the `entry` helper, answered in place. @type {Invoke} */
export const invoke = (fn, fixed, rest) => fn[0] === 'entry'
    ? entryCall(fixed, invoke)
    : vm({ frame: fn[2], args: [], fixed, rest, self: fn })(fn[3])

/** @type {(context: Context) => (e: Exp) => ValueResult} */
export const vm = context => {
    const { memo } = context
    const run = operation({ context, operand: (e, state) => [state, evaluate(e)], expression: e => e, invoke })
    /** @type {(e: Exp) => ValueResult} */
    const evaluate = e => {
        if (!isArray(e)) { return ok(e) }
        const established = memo?.find(([node]) => node === e)
        return established === undefined ? run(e, null)[1] : ok(established[1])
    }
    return evaluate
}
