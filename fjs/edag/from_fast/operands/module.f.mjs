/**
 * Expose owning function returns at direct value-consumer boundaries. Eager
 * operands and tests become statement regions only when a return must cross
 * them. Member, optional and spread boundaries retain their evaluation.
 *
 * @module
 * @import { BindingId, Block, Exit, FunctionTarget, Operator, Statement, Value } from '../../../js/ast/types.ts'
 * @import { List } from '../../../types/list/types.ts'
 * @import { Task } from '../task/types.ts'
 * @import { _Context, _Region, _ResultMode, _Sequence, _Value } from './private.ts'
 */

import { isBinary, isUnary, lazyLayers } from '../../../compiler/ast/module.f.js'
import { mapOperator, operatorOperands } from '../../../js/ast/module.f.mjs'
import { toArray } from '../../../types/list/module.f.mjs'
import { bind, call, done, run } from '../task/module.f.mjs'

/** @type {() => BindingId} */
const binding = () => ({ index: 0 })
/** @type {(id: BindingId) => Value} */
const ref = id => ['ref', id]

/** Source logical tags must first become FAST conditional regions. @type {(node: readonly unknown[]) => boolean} */
const eagerBinary = node => isBinary(node) && !lazyLayers.some(layer => Object.values(layer).some(tag => tag === node[0]))

/** Only the value's own loops may supply loop transfers through this boundary. @type {(owner: FunctionTarget) => _Context} */
const operandContext = owner => ({ owner, operand: true, loops: null })

/** A reference is already a bare callee; member lookup syntax must stay intact. @type {(source: Value, callee?: boolean) => _Value} */
const plain = (source, callee = !(source instanceof Array) || source[0] === 'ref' || source[0] === 'function'
    || source[0] === 'array' || source[0] === 'object') =>
    ({ statement: null, value: source, normal: true, callee })

/** Establish ordered operands, retaining their independent result identities. @type {(input: readonly Value[], owner: FunctionTarget, plainCall: boolean) => Task<_Sequence>} */
const sequenceTask = (input, owner, plainCall) => {
    /** @type {(statements: List<Statement>, values: List<Value>, normal: boolean, lifted: boolean, callee: boolean, admitted?: boolean) => Task<_Sequence>} */
    const finish = (statements, values, normal, lifted, callee, admitted = true) => done({
        statements: toArray(statements).toReversed(), values: toArray(values).toReversed(), normal, lifted, callee, admitted,
    })
    /** @type {(index: number, statements: List<Statement>, values: List<Value>, lifted: boolean, lastCallee: boolean) => Task<_Sequence>} */
    const each = (index, statements, values, lifted, lastCallee) => call(() => {
        if (index === input.length) { return finish(statements, values, true, lifted, lastCallee) }
        const id = binding()
        return bind(valueTask(input[index], id, owner), result => {
            if (plainCall && index === 0 && !result.callee) { return finish(null, null, true, false, false, false) }
            const statement = result.statement ?? /** @type {Statement} */ (['define', id, result.value, 'required'])
            const next = /** @type {List<Statement>} */ ({ first: statement, tail: statements })
            if (!result.normal) { return finish(next, values, false, true, true) }
            return each(index + 1, next, { first: ref(id), tail: values }, lifted || result.statement !== null, result.callee)
        })
    })
    return each(0, null, null, false, false)
}

/** Snapshot eager operands in source order; object keys convert before their values. @type {(source: Operator<Value>, destination: BindingId, owner: FunctionTarget) => Task<_Value>} */
const eagerTask = (source, destination, owner) => {
    const input = operatorOperands(source).map((value, index) => source[0] === 'object' && index % 2 === 0
        ? /** @type {Value} */ (['String', value]) : value)
    return bind(sequenceTask(input, owner, source[0] === '()'), result => {
        if (!result.admitted) { return done(plain(source, false)) }
        const callee = source[0] !== ',' || result.callee
        if (!result.lifted) { return done(plain(source, callee)) }
        return done({
            statement: ['block', [destination], { statements: result.statements, exit: result.normal
                ? ['yield', [mapOperator((_, index) => result.values[index])(source)]] : ['yield', []] }],
            value: ref(destination), normal: result.normal, callee: !result.normal || callee,
        })
    })
}

/**
 * Eager operations, constructor checks, comma sequences, spread-free collections
 * and bare calls sequence their value operands. Constructor metadata, chains,
 * lazy initializers and ordinary functions/captures remain opaque.
 * @type {(source: Value, destination: BindingId, owner: FunctionTarget) => Task<_Value>}
 */
const valueTask = (source, destination, owner) => call(() => {
    if (!(source instanceof Array)) { return done(plain(source)) }
    if (source[0] === 'block') {
        return bind(blockTask(source[1], operandContext(owner), 'value'), result => done(result.returns
            ? { statement: ['block', [destination], result.block], value: ref(destination), normal: result.normal, callee: result.callee }
            : plain(source, result.callee)))
    }
    if (isUnary(source) || eagerBinary(source) || source[0] === 'instanceof' || source[0] === '+' && source.length === 2
        || source[0] === ',' && source[1].length !== 0
        || source[0] === 'object' && !source[1].some(entry => entry[0] === '...')
        || (source[0] === '()' || source[0] === 'array')
            && !(source[0] === 'array' ? source[1] : source[2]).some(item => item instanceof Array && item[0] === '...')) {
        return eagerTask(/** @type {Operator<Value>} */ (source), destination, owner)
    }
    if (source[0] !== 'if' && source[0] !== '?:') { return done(plain(source)) }
    const then = source[0] === 'if' ? source[2] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[2]]] })
    const otherwise = source[0] === 'if' ? source[3] : /** @type {Block} */ ({ statements: [], exit: ['yield', [source[3]]] })
    return bind(valueTask(source[1], binding(), owner), test => {
        if (!test.normal) { return done({
            statement: ['block', [destination], { statements: [/** @type {Statement} */ (test.statement)], exit: ['yield', []] }],
            value: ref(destination), normal: false, callee: true,
        }) }
        return bind(blockTask(then, operandContext(owner), 'value'), a =>
            bind(blockTask(otherwise, operandContext(owner), 'value'), b => {
                const callee = a.callee && b.callee
                if (test.statement === null && !a.returns && !b.returns) { return done(plain(source, callee)) }
                const result = test.statement === null ? destination : binding()
                const conditional = /** @type {Statement} */ (['if', [result], test.value, a.block, b.block])
                return done({
                    statement: test.statement === null ? conditional : ['block', [destination], {
                        statements: [test.statement, conditional], exit: ['yield', [ref(result)]],
                    }],
                    value: ref(destination), normal: a.normal || b.normal, callee,
                })
            }))
    })
})

/** @type {(source: Block, context: _Context, mode: _ResultMode) => Task<_Region>} */
const blockTask = (source, context, mode) => {
    /** @type {(statements: List<Statement>, exit: Exit, normal: boolean, returns: boolean, lifted: boolean, changed: boolean, callee?: boolean) => Task<_Region>} */
    const finish = (statements, exit, normal, returns, lifted, changed, callee = false) => done({
        block: changed ? { statements: toArray(statements).toReversed(), exit } : source, normal, returns, lifted, callee: !normal || callee,
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
            /** @type {(mapped: Exit, next: List<Statement>, added: boolean, callee?: boolean) => Task<_Region>} */
            const complete = (mapped, next, added, callee = false) => {
                const normal = mapped[0] === 'yield'
                const packed = /** @type {Exit} */ (mode === 'value' && normal && mapped[1].length !== 1
                    ? ['yield', [['array', mapped[1]]]] : mapped)
                return finish(next, packed, normal, returns || ownReturn || added, lifted || added,
                    changed || packed !== source.exit || added, callee || normal && mapped[0] === 'yield' && mapped[1].length !== 1)
            }
            if (mode === 'statement' && exit[0] === 'yield') {
                return bind(sequenceTask(exit[1], context.owner, false), result => {
                    if (!result.lifted) { return complete(exit, statements, false) }
                    const next = result.statements.reduce((tail, first) => /** @type {List<Statement>} */ ({ first, tail }), statements)
                    if (!result.normal) { return finish(next, ['yield', []], false, true, true, true) }
                    return complete(['yield', result.values], next, true, result.callee)
                })
            }
            if (ownReturn || context.operand && exit[0] === 'yield' && (exit[1].length === 1 || mode === 'value')) {
                const values = /** @type {Extract<Exit, readonly ['yield', ...unknown[]]>} */ (exit)[1]
                const value = ownReturn ? /** @type {Extract<Exit, readonly ['return', ...unknown[]]>} */ (exit)[2]
                    : values.length === 1 ? values[0] : /** @type {Value} */ (['array', values])
                return bind(valueTask(value, binding(), context.owner), result => {
                    if (result.statement === null) { return complete(exit, statements, false, result.callee) }
                    const next = /** @type {List<Statement>} */ ({ first: result.statement, tail: statements })
                    if (!result.normal) { return finish(next, ['yield', []], false, true, true, true) }
                    return complete(ownReturn ? ['return', context.owner, result.value] : ['yield', [result.value]], next, true, result.callee)
                })
            }
            return complete(exit, statements, false)
        }
        const statement = source.statements[index]
        /** @type {(mapped: Statement, normal: boolean, addedReturns: boolean, addedLifted: boolean, leading?: Statement | null) => Task<_Region>} */
        const append = (mapped, normal, addedReturns, addedLifted, leading = null) => {
            const next = /** @type {List<Statement>} */ ({ first: mapped, tail: leading === null ? statements : { first: leading, tail: statements } })
            const different = changed || mapped !== statement || leading !== null
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
            return bind(blockTask(statement[1].body, { ...context, loops: { first: statement[1].target, tail: context.loops } }, 'none'), result => append(
                result.block === statement[1].body ? statement : ['loop', { ...statement[1], body: result.block }],
                true, result.returns, result.lifted))
        }
        if (statement[0] === 'block') {
            return bind(blockTask(statement[2], context, 'statement'), result => append(
                result.block === statement[2] ? statement : ['block', statement[1], result.block], result.normal, result.returns, result.lifted))
        }
        return bind(valueTask(statement[2], binding(), context.owner), test => {
            if (!test.normal) { return append(/** @type {Statement} */ (test.statement), false, true, true) }
            return bind(blockTask(statement[3], context, 'statement'), then =>
                bind(blockTask(statement[4], context, 'statement'), otherwise => append(
                    test.statement === null && then.block === statement[3] && otherwise.block === statement[4] ? statement
                        : ['if', statement[1], test.value, then.block, otherwise.block],
                    then.normal || otherwise.normal, then.returns || otherwise.returns || test.statement !== null,
                    then.lifted || otherwise.lifted || test.statement !== null, test.statement)))
        })
    })
    return each(0, null, false, false, false)
}

/**
 * Normalize direct required initializers, return payloads and statement results.
 * No owning return to expose means no change to the input block identity.
 * @type {(block: Block, owner: FunctionTarget) => Block}
 */
export const liftReturns = (block, owner) => {
    const result = run(blockTask(block, { owner, operand: false, loops: null }, 'none'))
    return result.lifted ? result.block : block
}
