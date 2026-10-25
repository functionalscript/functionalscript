/**
 * Expose owning function returns at direct value-consumer boundaries. Plain
 * blocks and conditional arms become statement regions only when a return
 * must cross them. Other operands retain their existing evaluation boundary.
 *
 * @module
 * @import { BindingId, Block, Exit, FunctionTarget, Statement, Value } from '../../../js/ast/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Task } from '../task/types.ts'
 * @import { _Context, _Region, _Value } from './private.ts'
 */

import { toArray } from '../../../types/list/module.f.mjs'
import { bind, call, done, run } from '../task/module.f.mjs'

/** @type {() => BindingId} */
const binding = () => ({ index: 0 })
/** @type {(id: BindingId) => Value} */
const ref = id => ['ref', id]

/** Only the value's own loops may supply loop transfers through this boundary. @type {(owner: FunctionTarget) => _Context} */
const operandContext = owner => ({ owner, operand: true, loops: null })

/** @type {(source: Value) => _Value} */
const plain = source => ({ statement: null, value: source, normal: true })

/**
 * Conditional tests, arbitrary operators, lazy initializers and ordinary
 * functions/captures remain opaque. A selected arm's single final value may
 * expose another plain region through blockTask's normal-yield continuation.
 * @type {(source: Value, destination: BindingId, owner: FunctionTarget) => Task<_Value>}
 */
const valueTask = (source, destination, owner) => call(() => {
    if (!(source instanceof Array)) { return done(plain(source)) }
    if (source[0] === 'block') {
        return bind(blockTask(source[1], operandContext(owner), true), result => done(result.returns
            ? { statement: ['block', [destination], result.block], value: ref(destination), normal: result.normal }
            : plain(source)))
    }
    if (source[0] !== 'if' && source[0] !== '?:') { return done(plain(source)) }
    const then = source[0] === 'if' ? source[2] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[2]]] })
    const otherwise = source[0] === 'if' ? source[3] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[3]]] })
    return bind(blockTask(then, operandContext(owner), true), a =>
        bind(blockTask(otherwise, operandContext(owner), true), b => done(a.returns || b.returns
            ? { statement: ['if', [destination], source[1], a.block, b.block], value: ref(destination), normal: a.normal || b.normal }
            : plain(source))))
})

/** @type {(source: Block, context: _Context, pack: boolean) => Task<_Region>} */
const blockTask = (source, context, pack) => {
    /** @type {(statements: List<Statement>, exit: Exit, normal: boolean, returns: boolean, lifted: boolean, changed: boolean) => Task<_Region>} */
    const finish = (statements, exit, normal, returns, lifted, changed) => done({
        block: changed ? { statements: toArray(statements).toReversed(), exit } : source, normal, returns, lifted,
    })
    /** @type {(index: number, statements: List<Statement>, returns: boolean, lifted: boolean, changed: boolean) => Task<_Region>} */
    const each = (index, statements, returns, lifted, changed) => call(() => {
        if (index === source.statements.length) {
            const exit = source.exit
            if (context.operand && (exit[0] === 'return' && exit[1] !== context.owner
                || (exit[0] === 'break' || exit[0] === 'continue') && !toArray(context.loops).includes(exit[1]))) {
                throw 'a value region may return only to its owning function or transfer within its own loops'
            }
            const ownReturn = exit[0] === 'return' && exit[1] === context.owner
            /** @type {(mapped: Exit, next: List<Statement>, added: boolean) => Task<_Region>} */
            const complete = (mapped, next, added) => {
                const normal = mapped[0] === 'yield'
                const packed = /** @type {Exit} */ (pack && normal && mapped[1].length !== 1
                    ? ['yield', [['array', mapped[1]]]] : mapped)
                return finish(next, packed, normal, returns || ownReturn || added, lifted || added,
                    changed || packed !== source.exit || added)
            }
            if (ownReturn || context.operand && exit[0] === 'yield' && exit[1].length === 1) {
                const value = ownReturn ? /** @type {Extract<Exit, readonly ['return', ...unknown[]]>} */ (exit)[2]
                    : /** @type {Extract<Exit, readonly ['yield', ...unknown[]]>} */ (exit)[1][0]
                return bind(valueTask(value, binding(), context.owner), result => {
                    if (result.statement === null) { return complete(exit, statements, false) }
                    const next = /** @type {List<Statement>} */ ({ first: result.statement, tail: statements })
                    if (!result.normal) { return finish(next, ['yield', []], false, true, true, true) }
                    return complete(ownReturn ? ['return', context.owner, result.value] : ['yield', [result.value]], next, true)
                })
            }
            return complete(exit, statements, false)
        }
        const statement = source.statements[index]
        /** @type {(mapped: Statement, normal: boolean, addedReturns: boolean, addedLifted: boolean) => Task<_Region>} */
        const append = (mapped, normal, addedReturns, addedLifted) => {
            const next = /** @type {List<Statement>} */ ({ first: mapped, tail: statements })
            const different = changed || mapped !== statement
            if (normal) { return each(index + 1, next, returns || addedReturns, lifted || addedLifted, different) }
            const pruned = index + 1 !== source.statements.length || source.exit[0] !== 'yield' || source.exit[1].length !== 0
            return finish(next, ['yield', []], false, returns || addedReturns, lifted || addedLifted, different || pruned)
        }
        if (statement[0] === 'define') {
            if (statement[3] === 'lazy') { return append(statement, true, false, false) }
            return bind(valueTask(statement[2], statement[1], context.owner), result => append(
                result.statement ?? statement, result.normal, result.statement !== null, result.statement !== null))
        }
        if (statement[0] === 'loop') {
            return bind(blockTask(statement[1].body, { ...context, loops: { first: statement[1].target, tail: context.loops } }, false), result => append(
                result.block === statement[1].body ? statement : ['loop', { ...statement[1], body: result.block }],
                true, result.returns, result.lifted))
        }
        if (statement[0] === 'block') {
            return bind(blockTask(statement[2], context, false), result => append(
                result.block === statement[2] ? statement : ['block', statement[1], result.block], result.normal, result.returns, result.lifted))
        }
        return bind(blockTask(statement[3], context, false), then =>
            bind(blockTask(statement[4], context, false), otherwise => append(
                then.block === statement[3] && otherwise.block === statement[4] ? statement
                    : ['if', statement[1], statement[2], then.block, otherwise.block],
                then.normal || otherwise.normal, then.returns || otherwise.returns, then.lifted || otherwise.lifted)))
    })
    return each(0, null, false, false, false)
}

/**
 * Normalize a function body's direct required initializers and return payloads.
 * No owning return to expose means no change to the input block identity.
 * @type {(block: Block, owner: FunctionTarget) => Block}
 */
export const liftReturns = (block, owner) => {
    const result = run(blockTask(block, { owner, operand: false, loops: null }, false))
    return result.lifted ? result.block : block
}
