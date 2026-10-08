/**
 * Prepare and delegate bare calls of represented functions.
 * A failed callee skips arguments. Otherwise arguments and spreads resolve
 * left to right, stopping at the first failure. Arguments resolve before
 * rejecting a non-function, matching JavaScript's call evaluation order.
 *
 * Missing fixed arguments bind to tagged undefined; supplied values retain
 * their identities. Each successful call receives a fresh rest array after
 * the fixed prefix. The invoker receives the original function, including
 * its captures and body — or the `entry` helper, whose body is the
 * invoker's own to perform — and its result returns unchanged.
 *
 * The executor callback owns body evaluation and each new invocation's
 * state. This helper is stateless call preparation. Function metadata and
 * bindings satisfy the compiler/admission contract and are not revalidated.
 *
 * @module
 * @import { ItemsOver } from '../../types.ts'
 * @import { Values } from '../types.ts'
 * @import { ValueResult, ValueThunk } from '../control/types.ts'
 * @import { Invoke } from './types.ts'
 */

import { error } from '../../../types/result/module.f.mjs'
import { array } from '../array/module.f.mjs'
import { isFunction } from '../semantics/module.f.mjs'

/** Bind arguments and delegate an ordinary bare call. @type {(callee: ValueResult, args: ItemsOver<ValueThunk>, invoke: Invoke) => ValueResult} */
export const call = (callee, args, invoke) => {
    const [kind, fn] = callee
    if (kind === 'error') { return callee }
    const argumentsResult = array(args)
    const [argumentKind, argumentsArray] = argumentsResult
    if (argumentKind === 'error') { return argumentsResult }
    if (!isFunction(fn)) { return error(['undefined']) }
    // the `entry` helper takes its two, as its `length` says
    const length = fn[0] === 'entry' ? 2 : fn[1]
    const [, values] = argumentsArray
    /** @type {Values} */
    let fixed = []
    for (let i = 0; i < length; i += 1) {
        fixed = [...fixed, i < values.length ? values[i] : ['undefined']]
    }
    return invoke(fn, fixed, ['[]', values.slice(length)])
}
