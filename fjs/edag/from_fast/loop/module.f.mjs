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
 * @import { BindingId, Function as FastFunction, Loop, Statement, Value } from '../../../js/ast/types.ts'
 */

import { freeLoopBindings } from '../control/module.f.mjs'

/** @type {(value: Value, binding: BindingId) => boolean} */
const names = (value, binding) => value instanceof Array && value[0] === 'ref' && value[1] === binding

/**
 * Prefix reads may alias established captures or self without becoming current
 * invocation inputs. Each returned lineage keeps its fixed parameter position.
 * Root callers check their invocation layout before requesting these aliases.
 * @type {(fn: FastFunction, before: readonly Statement[]) => readonly (readonly BindingId[])[] | null}
 */
export const invocationAliases = (fn, before) => {
    let aliases = fn.parameters.map(parameter => [parameter])
    let established = [...fn.parameters, ...fn.captures.map(capture => capture.binding), ...(fn.self === null ? [] : [fn.self])]
    for (const statement of before) {
        if (statement[0] !== 'define') { return null }
        const value = statement[2]
        if (!(value instanceof Array) || value[0] !== 'ref' || !established.includes(value[1])) { return null }
        established = [...established, statement[1]]
        aliases = aliases.map(lineage => lineage.includes(value[1]) ? [...lineage, statement[1]] : lineage)
    }
    return aliases
}

/**
 * Reusing the function rebinds its parameters on each continue. Body reads of
 * entry parameters or their prefix aliases could then lose the original value.
 * Iteration parameters are bound by the free-reference owner; captures and self
 * do not belong to these parameter lineages and remain stable across calls.
 * @type {(loop: Loop, aliases: readonly (readonly BindingId[])[]) => boolean}
 */
export const readsEntryParameters = (loop, aliases) => {
    const entries = new Set(aliases.flat())
    return freeLoopBindings(loop).some(binding => entries.has(binding))
}

/**
 * The root scalar loop where its entry aliases the current invocation and its
 * result is returned directly, or `null` where reconstruction would change
 * the function boundary. Before the loop, aliases of invocation inputs, captures
 * and self establish no computation or identity. The entry must still follow
 * the current invocation input's own alias lineage.
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
    const aliases = invocationAliases(fn, body.statements.slice(0, -1))
    return aliases !== null && aliases[0].some(binding => names(loop.initial[0], binding)) && !readsEntryParameters(loop, aliases) ? loop : null
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
