/**
 * Canonical scalar loops at the FAST-to-EDAG boundary.
 *
 * A function consisting of its invocation loop can reuse the function itself
 * as the recursive helper. This preserves its arity, frame and self identity;
 * a loop with one-time setup or result processing needs a separate helper.
 * The baseline domain is one fixed parameter without a rest binding. General
 * invocation layouts are added with the corresponding conversion machinery.
 *
 * @module
 *
 * @import { BindingId, Function as FastFunction, Loop, Value } from '../../../js/ast/types.ts'
 */

import { freeLoopBindings } from '../control/module.f.mjs'

/** @type {(value: Value, binding: BindingId) => boolean} */
const names = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/**
 * The root scalar loop where its entry aliases the current invocation and its
 * result is returned directly, or `null` where reconstruction would change
 * the function boundary. Before the loop, only aliases of invocation inputs
 * are admitted; these establish no computation or identity of their own.
 *
 * @type {(fn: FastFunction) => Loop | null}
 */
export const rootLoopOf = fn => {
    const { parameters, rest, body } = fn
    const exit = body.exit
    if (parameters.length !== 1 || rest !== null || exit[0] !== 'return' || exit[1] !== fn.target) { return null }
    const last = body.statements.at(-1)
    if (last === undefined || last[0] !== 'loop') { return null }
    const loop = last[1]
    if (loop.parameters.length !== 1 || loop.results.length !== 1 || !names(exit[2], loop.results[0])) { return null }
    /** @type {readonly BindingId[]} */
    let aliases = parameters
    for (const statement of body.statements.slice(0, -1)) {
        if (statement[0] !== 'define') { return null }
        const value = statement[2]
        if (!(value instanceof Array) || value[0] !== 'ref' || !aliases.includes(value[1])) { return null }
        aliases = [...aliases, statement[1]]
    }
    return aliases.some(binding => names(loop.initial[0], binding)) ? loop : null
}

/**
 * The scalar helper as an ordinary normalized function, so its frame and
 * captures use the same graph construction as every function. Its invocation
 * loop is canonical; graph construction reuses this very function for it.
 * Entry expressions stay at the original loop statement in the caller.
 *
 * @type {(loop: Loop) => FastFunction}
 */
export const scalarHelper = loop => {
    const target = /** @type {const} */ ({ kind: 'function', index: loop.target.index })
    return {
        target,
        parameters: loop.parameters,
        rest: null,
        self: null,
        captures: freeLoopBindings(loop).map(binding => ({ binding, value: ['ref', binding] })),
        body: {
            statements: [['loop', { ...loop, initial: loop.parameters.map(binding => ['ref', binding]) }]],
            exit: ['return', target, ['ref', loop.results[0]]],
        },
    }
}

