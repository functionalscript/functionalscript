/**
 * Prepare and delegate bare calls of represented functions.
 * A failed callee skips arguments. Otherwise arguments and spreads resolve
 * left to right, stopping at the first failure. Arguments resolve before
 * rejecting a non-function, matching JavaScript's call evaluation order.
 *
 * Missing fixed arguments bind to tagged undefined; supplied values retain
 * their identities. Each successful call receives a fresh rest array after
 * the fixed prefix. The invoker receives the original function, including
 * its captures and body — or the `entry` helper or `Object.entries`,
 * whose body is the invoker's own to perform — and its result returns
 * unchanged.
 *
 * A call in tail position is prepared and left for the executor, which
 * makes it in the invocation's place: `invoker` turns a body evaluator into
 * an `Invoke` that makes each call a body leaves, one after the other, so a
 * chain of tail calls however long holds one set of host frames. `settle`
 * makes the one call an outcome leaves where its value is needed at once.
 *
 * The executor callback owns body evaluation and each new invocation's
 * state. This helper is stateless call preparation. Function metadata and
 * bindings satisfy the compiler/admission contract and are not revalidated.
 *
 * @module
 * @import { ItemsOver } from '../../types.ts'
 * @import { Values } from '../types.ts'
 * @import { ValueResult, ValueThunk } from '../control/types.ts'
 * @import { Body, Invoke, Outcome } from './types.ts'
 */

import { error } from '../../../types/result/module.f.js'
import { array } from '../array/module.f.mjs'
import { isFunction } from '../semantics/module.f.mjs'

/** Bind arguments to a bare call without making it. @type {(callee: ValueResult, args: ItemsOver<ValueThunk>) => Outcome} */
export const prepare = (callee, args) => {
    const [kind, fn] = callee
    if (kind === 'error') { return callee }
    const argumentsResult = array(args)
    const [argumentKind, argumentsArray] = argumentsResult
    if (argumentKind === 'error') { return argumentsResult }
    if (!isFunction(fn)) { return error(['undefined']) }
    // the `entry` helper takes its two and `Object.entries` its one, as
    // each one's `length` says
    const length = fn[0] === 'entry' ? 2 : fn[0] === 'Object.entries' ? 1 : fn[1]
    const [, values] = argumentsArray
    /** @type {Values} */
    let fixed = []
    for (let i = 0; i < length; i += 1) {
        fixed = [...fixed, i < values.length ? values[i] : ['undefined']]
    }
    return ['call', fn, fixed, ['[]', values.slice(length)]]
}

/** Make the call an outcome leaves, if one, where its value is needed now. @type {(invoke: Invoke) => (outcome: Outcome) => ValueResult} */
export const settle = invoke => outcome => outcome[0] === 'call' ? invoke(outcome[1], outcome[2], outcome[3]) : outcome

/** An invoker over a body evaluator: each call a body leaves in its place is made in the invocation's place. @type {(body: Body) => Invoke} */
export const invoker = body => (fn, fixed, rest) => {
    let outcome = body(fn, fixed, rest)
    while (outcome[0] === 'call') { outcome = body(outcome[1], outcome[2], outcome[3]) }
    return outcome
}

/** Bind arguments and make an ordinary bare call. @type {(callee: ValueResult, args: ItemsOver<ValueThunk>, invoke: Invoke) => ValueResult} */
export const call = (callee, args, invoke) => settle(invoke)(prepare(callee, args))
