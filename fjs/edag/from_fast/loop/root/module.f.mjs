/**
 * Canonical invocation loops reuse the ordinary function and its public result.
 * Only aliases precede the loop; each loop input is one current invocation input.
 * The loop's internal array values remain opaque, including helper protocols.
 * This owner resolves tail statement transfers while preserving their regions
 * for the graph constructor's shared normal/control joins.
 * Nonroot helpers and nonlocal value operands have separate construction owners.
 *
 * @module
 * @import { Block, Exit, Function as FastFunction, Loop, Statement } from '../../../../js/ast/types.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { _Owner, _Result } from './private.ts'
 * @import { Task } from '../../task/types.ts'
 */

import { toArray } from '../../../../types/list/module.f.mjs'
import { maxLength } from '../../../../types/function/length/module.f.mjs'
import { invocationAliases, namesBinding, readsEntryParameters } from '../module.f.mjs'
import { bind, call, done, run } from '../../task/module.f.mjs'

/**
 * A fixed invocation layout with its whole public result returned directly.
 * Established capture/self aliases are harmless prefix reads. Only parameter
 * lineages retain an input position; equal debug indices never merge slots.
 * Rest invocation transitions belong to the shared argument recipe owner.
 * @type {(fn: FastFunction) => Loop | null}
 */
export const invocationRootOf = fn => {
    const { body } = fn
    const exit = body.exit
    if (fn.parameters.length > maxLength || fn.rest !== null || exit[0] !== 'return' || exit[1] !== fn.target) { return null }
    const last = body.statements.at(-1)
    if (last === undefined || last[0] !== 'loop') { return null }
    const loop = last[1]
    if (loop.parameters.length !== fn.parameters.length || loop.initial.length !== fn.parameters.length
        || loop.results.length !== 1 || !namesBinding(exit[2], loop.results[0])) { return null }
    const aliases = invocationAliases(fn, body.statements.slice(0, -1))
    return aliases !== null && loop.initial.every((value, position) => aliases[position].some(binding => namesBinding(value, binding)))
        && !readsEntryParameters(loop, aliases) ? loop : null
}

/** Finish a region from reverse-collected statements. @type {(statements: List<Statement>, exit: Exit, normal: boolean) => Task<_Result>} */
const finished = (statements, exit, normal) => done({ block: { statements: toArray(statements).toReversed(), exit }, normal })

/**
 * Rewrite reached exits without substituting the following statements into
 * normal leaves. Nested loops and values retain their own owner. A region with
 * no normal path ends this walk before unreachable statements or exits.
 * `null` marks the root body, where a reached yield is invalid.
 * @type {(block: Block, owner: _Owner, expected: number | null) => Task<_Result>}
 */
const blockTask = (block, owner, expected) => {
    /** @type {(index: number, statements: List<Statement>) => Task<_Result>} */
    const each = (index, statements) => call(() => {
        if (index !== block.statements.length) {
            const statement = block.statements[index]
            if (statement[0] === 'define' || statement[0] === 'loop') { return each(index + 1, { first: statement, tail: statements }) }
            /** @type {(mapped: Statement, normal: boolean) => Task<_Result>} */
            const resume = (mapped, normal) => {
                const next = /** @type {List<Statement>} */ ({ first: mapped, tail: statements })
                return normal ? each(index + 1, next) : finished(next, block.exit, false)
            }
            if (statement[0] === 'block') {
                return bind(blockTask(statement[2], owner, statement[1].length), result => resume(['block', statement[1], result.block], result.normal))
            }
            return bind(blockTask(statement[3], owner, statement[1].length), then =>
                bind(blockTask(statement[4], owner, statement[1].length), otherwise =>
                    resume(['if', statement[1], statement[2], then.block, otherwise.block], then.normal || otherwise.normal)))
        }
        const exit = block.exit
        if (exit[0] === 'yield') {
            if (expected === null) { throw 'a normalized loop body requires an explicit transfer' }
            if (exit[1].length !== expected) { throw 'invalid canonical region result signature' }
            return finished(statements, exit, true)
        }
        if (exit[0] === 'return') {
            if (exit[1] !== owner.fn.target) { throw 'a root return must name its owning function' }
            return finished(statements, exit, false)
        }
        if (exit[0] === 'throw') { return finished(statements, exit, false) }
        if (exit[1] !== owner.loop.target) { throw 'a loop transfer must name its owning loop' }
        if (exit[0] === 'break') {
            if (exit[2].length !== 1) { throw 'an invocation loop has one whole public result' }
            return finished(statements, ['return', owner.fn.target, exit[2][0]], false)
        }
        if (exit[2].length !== owner.fn.parameters.length) { throw 'invalid canonical invocation transition signature' }
        return finished(statements, ['return', owner.fn.target, ['()', owner.self, exit[2]]], false)
    })
    return each(0, null)
}

/**
 * Resolve a matched root to the ordinary function constructor's own value body.
 * A synthesized self binding is lexical only; existing self/captures are kept.
 * A reached normal yield violates the normalized loop-body transfer contract.
 * @type {(fn: FastFunction, loop: Loop) => FastFunction}
 */
export const directInvocationRoot = (fn, loop) => {
    const self = fn.self ?? { index: fn.target.index }
    const owner = /** @type {_Owner} */ ({ fn, loop, self: ['ref', self] })
    const aliases = loop.parameters.map((binding, i) => /** @type {Statement} */ (['define', binding, loop.initial[i], 'lazy']))
    const prefix = fn.body.statements.slice(0, -1).map(statement => {
        const alias = /** @type {Extract<Statement, readonly ['define', ...unknown[]]>} */ (statement)
        return /** @type {Statement} */ (['define', alias[1], alias[2], 'lazy'])
    })
    const result = run(blockTask(loop.body, owner, null)).block
    return { ...fn, self, body: { statements: [...prefix, ...aliases, ...result.statements], exit: result.exit } }
}
