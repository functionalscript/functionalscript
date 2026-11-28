/**
 * Interpret EDAG without remembering newly evaluated nodes. Every incoming
 * edge evaluates its target again, except established nodes and function groups.
 * Call results exposing a group are retained to preserve member identity.
 * Represented function invocations start with no established nodes. A call
 * in tail position of a body is made in the invocation's place.
 *
 * @module
 * @import { Exp } from '../types.ts'
 * @import { ValueResult } from '../value/control/types.ts'
 * @import { Invoke, Outcome } from '../value/call/types.ts'
 * @import { EdagValue, Runtime } from '../value/types.ts'
 * @import { Evaluation, Tail } from '../operations/types.ts'
 * @import { Context } from './types.ts'
 */

import { isArray } from '../../types/array/module.f.js'
import { empty } from '../../types/ref_map/module.f.js'
import { ok } from '../../types/result/module.f.js'
import { invokerWith, moduleArgs, operation } from '../operations/module.f.js'
import { settle } from '../value/call/module.f.js'

/**
 * Whether recomputing a call's result could recreate a group reached through
 * that result. A closure's captures are already values, its body is still code.
 * Shared parts of a returned object are inspected once.
 * @type {(value: EdagValue) => boolean}
 */
const holdsMember = value => {
    /** @type {import('../../types/list/types.ts').List<EdagValue>} */
    let pending = { first: value, tail: null }
    let seen = empty
    while (pending !== null) {
        const { first, tail } = /** @type {import('../../types/list/types.ts').NonEmpty<EdagValue>} */ (pending)
        pending = tail
        if (!isArray(first)) { continue }
        if (first[0] === 'fn') { return true }
        if (first[0] !== '[]' && first[0] !== '{}' && first[0] !== '=>') { continue }
        const [known, next] = seen(first, true)
        if (known !== undefined) { continue }
        seen = next
        const children = first[0] === '[]' ? first[1] : first[0] === '=>' ? first[2] : first[1].map(([, , child]) => child)
        for (const child of children) { pending = { first: child, tail: pending } }
    }
    return false
}

/** An expression in tail position: its value, or the call it leaves. @type {(context: Context, invoke: Invoke) => (e: Exp) => Outcome} */
const outcome = (context, invoke) => {
    const { memo } = context
    const settled = settle(invoke)
    const args = moduleArgs(context)
    /**
     * Groups and call results exposing their members must survive a repeated
     * edge within this invocation. Every other value can be recomputed.
     * @type {(e: Exp, groups: NonNullable<Context['memo']>, tail: boolean) => Tail<NonNullable<Context['memo']>>}
     */
    const evaluate = (e, groups, tail) => {
        if (!isArray(e)) { return [groups, ok(e)] }
        const established = memo?.find(([node]) => node === e) ?? groups.find(([node]) => node === e)
        if (established !== undefined) { return [groups, ok(established[1])] }
        const run = operation({
            context,
            moduleArgs: args,
            operand: (child, state) => /** @type {Evaluation<NonNullable<Context['memo']>>} */ (evaluate(child, state, false)),
            tail: (child, state) => evaluate(child, state, tail),
            expression: child => child,
            invoke,
        })
        const [next, result] = run(e, groups)
        if (tail) { return [next, result] }
        const value = settled(result)
        const canCall = e[0] === '()' || e[0] === '?.()' || (e[0] === '.' || e[0] === '?.') && e.length === 4
        const keep = value[0] === 'ok' && (e[0] === 'group' || canCall && holdsMember(value[1]))
        return keep ? [[...next, [e, value[1]]], value] : [next, value]
    }
    return e => evaluate(e, [], true)[1]
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
