/**
 * Canonical invocation loops reuse the ordinary function and its public result.
 * Only aliases precede the loop; each loop input is one current invocation input.
 * The loop's internal array values remain opaque, including helper protocols.
 * This owner resolves tail statement transfers while preserving their regions
 * for the graph constructor's shared normal/control joins.
 * Nonroot helpers and nonlocal value operands have separate construction owners.
 *
 * @module
 * @import { Block, Exit, Function as FastFunction, Loop, LoopTarget, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Link } from '../../private.ts'
 * @import { _Owner, _RestResult, _Result } from './private.ts'
 * @import { Task } from '../../../../js/ast/task/types.ts'
 */

import { toArray } from '../../../../types/list/module.f.mjs'
import { maxLength } from '../../../../types/function/length/module.f.mjs'
import { invocationAliases, namesBinding, readsEntryParameters } from '../module.f.mjs'
import { bind, call, done, run } from '../../../../js/ast/task/module.f.js'
import { _restArguments } from '../../../../js/ast/invocation/module.f.mjs'
import { exitValues, hasLoopTransfer } from '../../../../js/ast/control/module.f.mjs'
import { assertNotNullish } from '../../../../asserts/module.f.js'

/** Validate reached statement transfers without crossing hidden transfer owners. @type {(block: Block, length: number, target: LoopTarget) => Task<_RestResult>} */
const restBlockTask = (block, length, target) => {
    /** @type {(index: number) => Task<_RestResult>} */
    const each = index => call(() => {
        if (index < block.statements.length) {
            const statement = block.statements[index]
            if (statement[0] === 'define' || statement[0] === 'loop') {
                const values = statement[0] === 'define' ? [statement[2]] : [...statement[1].initial, statement[1].body]
                return values.some(value => hasLoopTransfer(value, target)) ? done({ valid: false, normal: false }) : each(index + 1)
            }
            /** @type {(result: _RestResult) => Task<_RestResult>} */
            const resume = result => result.valid && result.normal ? each(index + 1) : done(result)
            if (statement[0] === 'block') { return bind(restBlockTask(statement[2], length, target), resume) }
            if (hasLoopTransfer(statement[2], target)) { return done({ valid: false, normal: false }) }
            return bind(restBlockTask(statement[3], length, target), then => bind(restBlockTask(statement[4], length, target), otherwise =>
                resume({ valid: then.valid && otherwise.valid, normal: then.normal || otherwise.normal })))
        }
        const exit = block.exit
        const valid = !exitValues(exit).some(value => hasLoopTransfer(value, target))
            && (exit[0] !== 'continue' || exit[1] === target && _restArguments(block, length, target) !== null)
            && (exit[0] !== 'break' || exit[1] === target)
        return done({ valid, normal: exit[0] === 'yield' })
    })
    return each(0)
}

/**
 * An invocation layout with its whole public result returned directly.
 * Established capture/self aliases are harmless prefix reads. Only parameter
 * lineages retain an input position; equal debug indices never merge slots.
 * A rest input follows the fixed inputs and uses the shared fresh-rest recipe.
 * @type {(fn: FastFunction) => Loop | null}
 */
export const invocationRootOf = fn => {
    const { body } = fn
    const exit = body.exit
    if (fn.parameters.length > maxLength || exit[0] !== 'return' || exit[1] !== fn.target) { return null }
    const last = body.statements.at(-1)
    if (last === undefined || last[0] !== 'loop') { return null }
    const loop = last[1]
    const length = fn.parameters.length + (fn.rest === null ? 0 : 1)
    if (loop.parameters.length !== length || loop.initial.length !== length
        || loop.results.length !== 1 || !namesBinding(exit[2], loop.results[0])) { return null }
    const aliases = invocationAliases(fn, body.statements.slice(0, -1))
    return aliases !== null && loop.initial.every((value, position) => aliases[position].some(binding => namesBinding(value, binding)))
        && !readsEntryParameters(loop, aliases)
        && (fn.rest === null || run(restBlockTask(loop.body, fn.parameters.length, loop.target)).valid) ? loop : null
}

/** Finish a region from reverse-collected statements. @type {(statements: Link<Statement> | null, exit: Exit, normal: boolean) => Task<_Result>} */
const finished = (statements, exit, normal) => done({ block: { statements: toArray(statements).toReversed(), exit }, normal })

/**
 * Rewrite reached exits without substituting the following statements into
 * normal leaves. Nested loops and values retain their own owner. A region with
 * no normal path ends this walk before unreachable statements or exits.
 * `null` marks the root body, where a reached yield is invalid.
 * @type {(block: Block, owner: _Owner, expected: number | null) => Task<_Result>}
 */
const blockTask = (block, owner, expected) => {
    /** @type {(index: number, statements: Link<Statement> | null) => Task<_Result>} */
    const each = (index, statements) => call(() => {
        if (index !== block.statements.length) {
            const statement = block.statements[index]
            if (statement[0] === 'define' || statement[0] === 'loop') { return each(index + 1, { first: statement, tail: statements }) }
            /** @type {(mapped: Statement, normal: boolean) => Task<_Result>} */
            const resume = (mapped, normal) => {
                const next = /** @type {Link<Statement>} */ ({ first: mapped, tail: statements })
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
        if (owner.fn.rest !== null) {
            const args = _restArguments(block, owner.fn.parameters.length, owner.loop.target)
            if (args === null) { throw 'invalid canonical rest invocation transition' }
            return finished(assertNotNullish(statements).tail, ['return', owner.fn.target, ['()', owner.self, args]], false)
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
