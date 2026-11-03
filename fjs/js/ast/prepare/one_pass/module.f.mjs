/**
 * Recover an immutable join from a canonical one-pass invocation wrapper.
 * Genuine invocation transitions and other normalized profiles keep their
 * established loop plan, including the source profile's state/result layout.
 *
 * @module
 * @import { Block, Definition, Function as FastFunction, Statement } from '../../types.ts'
 * @import { _Link } from '../private.ts'
 */

import { directInvocationRoot, invocationRootOf } from '../../../../edag/from_fast/loop/root/module.f.mjs'
import { freeBindings } from '../../control/module.f.mjs'
import { _freshAtRoot, _immutableJoin } from '../joins/module.f.mjs'

/**
 * The accepted join profile has only definitions and zero-result decisions.
 * Its guard-only subset needs an empty normal alternative and a terminating
 * then block. Other accepted joins keep their invocation scope in source.
 * @type {(body: Block) => boolean}
 */
const terminatingGuards = body => {
    /** @type {_Link<Block> | null} */
    let pending = { first: body, tail: null }
    while (pending !== null) {
        /** @type {_Link<Block>} */
        const current = pending
        const { first, tail } = current
        if (first.exit[0] !== 'return' && first.exit[0] !== 'throw') { return false }
        const guards = first.statements.flatMap(statement => statement[0] === 'if' ? [statement] : [])
        if (!guards.every(statement => statement[4].statements.length === 0 && statement[4].exit[0] === 'yield')) { return false }
        pending = guards.reduceRight((tail, statement) => ({ first: statement[3], tail }), tail)
    }
    return true
}

/**
 * Only the existing immutable-join profile can consume the removed region.
 * The invocation resolver restores visible backedges as reads of its fresh
 * self binding; such a read prevents recovery. Hidden transfer regions are
 * outside the immutable profile, so they retain their original loop owner.
 * @type {(fn: FastFunction, guardsOnly?: boolean) => FastFunction}
 */
export const _recoverOnePassJoin = (fn, guardsOnly = false) => {
    if (fn.self !== null) { return fn }
    const loop = invocationRootOf(fn)
    if (loop === null) { return fn }
    // invocationRootOf proves this prefix consists only of established reads;
    // its return type does not carry that definition-only refinement.
    const definitions = /** @type {readonly Definition[]} */ (fn.body.statements.slice(0, -1))
    const before = definitions.map(([, binding]) => binding)
    if (!_freshAtRoot(fn, before, loop.parameters)) { return fn }
    const restored = directInvocationRoot(fn, loop)
    if (freeBindings(restored.body).some(binding => binding === restored.self)) { return fn }
    /** @type {readonly Statement[]} */
    const prefix = definitions.map(([, binding, value]) => ['define', binding, value, 'required'])
    /** @type {readonly Statement[]} */
    const snapshots = loop.parameters.map((binding, index) => ['define', binding, loop.initial[Number(index)], 'required'])
    /** @type {FastFunction} */
    const candidate = { ...restored, self: fn.self, body: {
        statements: [...prefix, ...snapshots, ...restored.body.statements.slice(prefix.length + snapshots.length)],
        exit: restored.body.exit,
    } }
    const joined = _immutableJoin(candidate)
    if (joined === candidate) { return fn }
    if (guardsOnly && !terminatingGuards(joined.body)) { return fn }
    const lifted = joined.body.statements.slice(prefix.length).flatMap(statement => statement[0] === 'define' ? [statement[1]] : [])
    return _freshAtRoot(fn, before, lifted) ? joined : fn
}
