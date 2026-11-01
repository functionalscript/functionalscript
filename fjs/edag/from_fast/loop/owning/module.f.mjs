/**
 * Keep owning self tail calls explicit before statement loops become helpers.
 * The outer loop represents a whole invocation: its inputs are simultaneous,
 * and every original local/default initializer remains inside each iteration.
 * Ordinary nested functions retain their own return and recursion owner.
 *
 * @module
 * @import { BindingId, Block, Exit, Function as FastFunction, Loop, LoopTarget, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Task } from '../../../../js/ast/task/types.ts'
 * @import { _Context, _Result } from './private.ts'
 */

import { mapOperator, operatorOperands } from '../../../../js/ast/module.f.mjs'
import { _invocationTransition, _isSelf } from '../../../../js/ast/invocation/module.f.js'
import { _tailRegion } from '../../../../js/ast/invocation/tail/module.f.js'
import { bind, call, done, run } from '../../../../js/ast/task/module.f.js'

/** @type {<T>(value: T, tail?: boolean, base?: boolean) => _Result<T>} */
const result = (value, tail = false, base = false) => ({ value, tail, base })

/**
 * @template T, U
 * @param {readonly T[]} source
 * @param {(value: T) => Task<_Result<U>>} task
 * @returns {Task<_Result<readonly U[]>>}
 */
const eachTask = (source, task) => {
    /** @type {(index: number, values: readonly U[], tail: boolean, base: boolean) => Task<_Result<readonly U[]>>} */
    const each = (index, values, tail, base) => call(() => index === source.length ? done(result(values, tail, base))
        : bind(task(source[index]), item => each(index + 1, [...values, item.value], tail || item.tail, base || item.base)))
    return each(0, [], false, false)
}

/** Map evaluation regions without entering an ordinary function's body. @type {(value: Value, context: _Context) => Task<_Result<Value>>} */
const valueTask = (value, context) => {
    /** @type {() => Task<_Result<Value>>} */
    const visit = () => {
        if (!(value instanceof Array)) { return done(result(value)) }
        if (value[0] === 'ref') { return done(result(_isSelf(value, context.aliases) ? ['ref', context.aliases[0]] : value)) }
        if (value[0] === 'block') { return bind(blockTask(value[1], context, false), body => done(result(['block', body.value], body.tail, body.base))) }
        if (value[0] === 'if') {
            return bind(valueTask(value[1], context), test => bind(blockTask(value[2], context, false), then =>
                bind(blockTask(value[3], context, false), otherwise => done(result(['if', test.value, then.value, otherwise.value],
                    test.tail || then.tail || otherwise.tail, test.base || then.base || otherwise.base)))))
        }
        if (value[0] === 'function') {
            const fn = value[1]
            return bind(eachTask(fn.captures.map(capture => capture.value), capture => valueTask(capture, context)), captures =>
                done(result(['function', { ...fn, captures: fn.captures.map((capture, i) => ({ ...capture, value: captures.value[i] })) }], captures.tail, captures.base)))
        }
        return bind(eachTask(operatorOperands(value), operand => valueTask(operand, context)), operands =>
            done(result(mapOperator((_, index) => operands.value[index])(value), operands.tail, operands.base)))
    }
    return call(visit)
}

/** Return a selected value directly to this invocation, preserving its regions. @type {(value: Value, context: _Context) => Task<_Result<Block>>} */
const tailValueTask = (value, context) => call(() => {
    const region = _tailRegion(value, context.target.index)
    if (region.kind === 'block') { return blockTask(region.block, context, true) }
    if (region.kind === 'if') {
        return bind(valueTask(region.test, context), test => bind(blockTask(region.then, context, true), then =>
            bind(blockTask(region.otherwise, context, true), otherwise =>
                done(result({ statements: [['if', [], test.value, then.value, otherwise.value]], exit: ['yield', []] },
                    test.tail || then.tail || otherwise.tail, test.base || then.base || otherwise.base)))))
    }
    return bind(valueTask(region.value, context), mapped => {
        const call = mapped.value
        if (call instanceof Array && call[0] === '()' && _isSelf(call[1], context.aliases)) {
            return done(result(_invocationTransition(context.length, call[2], context.target, context.rest), mapped.tail || context.insideLoop, mapped.base))
        }
        return done(result({ statements: [], exit: ['break', context.target, [mapped.value]] }, mapped.tail, true))
    })
})

/** @type {(loop: Loop, context: _Context) => Task<_Result<Loop>>} */
const loopTask = (loop, context) => bind(eachTask(loop.initial, value => valueTask(value, context)), initial =>
    bind(blockTask(loop.body, { ...context, insideLoop: true }, false), body => done(result({ ...loop, initial: initial.value, body: body.value },
        initial.tail || body.tail, initial.base || body.base))))

/** @type {(statement: Statement, context: _Context) => Task<_Result<Statement>>} */
const statementTask = (statement, context) => {
    /** @type {() => Task<_Result<Statement>>} */
    const visit = () => {
        if (statement[0] === 'define') {
            return bind(valueTask(statement[2], context), value => done(result(['define', statement[1], value.value, statement[3]], value.tail, value.base)))
        }
        if (statement[0] === 'loop') { return bind(loopTask(statement[1], context), loop => done(result(['loop', loop.value], loop.tail, loop.base))) }
        if (statement[0] === 'block') { return bind(blockTask(statement[2], context, false), body => done(result(['block', statement[1], body.value], body.tail, body.base))) }
        return bind(valueTask(statement[2], context), test => bind(blockTask(statement[3], context, false), then =>
            bind(blockTask(statement[4], context, false), otherwise => done(result(['if', statement[1], test.value, then.value, otherwise.value],
                test.tail || then.tail || otherwise.tail, test.base || then.base || otherwise.base)))))
    }
    return call(visit)
}

/** @type {(exit: Exit, context: _Context, returnedYield: boolean) => Task<_Result<Block>>} */
const exitTask = (exit, context, returnedYield) => {
    if (exit[0] === 'return' && exit[1] === context.owner) { return tailValueTask(exit[2], context) }
    if (exit[0] === 'yield' && returnedYield && exit[1].length === 1) { return tailValueTask(exit[1][0], context) }
    if (exit[0] === 'loop') { return bind(loopTask(exit[1], context), loop => done(result({ statements: [], exit: ['loop', loop.value] }, loop.tail, loop.base))) }
    if (exit[0] === 'return' || exit[0] === 'throw') {
        const value = exit[0] === 'return' ? exit[2] : exit[1]
        return bind(valueTask(value, context), mapped => done(result({ statements: [],
            exit: exit[0] === 'return' ? ['return', exit[1], mapped.value] : ['throw', mapped.value] }, mapped.tail, mapped.base)))
    }
    return bind(eachTask(exit[0] === 'yield' ? exit[1] : exit[2], value => valueTask(value, context)), values =>
        done(result({ statements: [], exit: exit[0] === 'yield' ? ['yield', values.value] : [exit[0], exit[1], values.value] }, values.tail, values.base)))
}

/** Sequential definitions establish immutable self aliases only in their lexical region. @type {(block: Block, context: _Context, returnedYield: boolean) => Task<_Result<Block>>} */
const blockTask = (block, context, returnedYield) => {
    /** @type {(index: number, aliases: readonly BindingId[], statements: readonly Statement[], tail: boolean, base: boolean) => Task<_Result<Block>>} */
    const each = (index, aliases, statements, tail, base) => call(() => {
        /** @type {_Context} */
        const local = { ...context, aliases }
        if (index === block.statements.length) {
            return bind(exitTask(block.exit, local, returnedYield), exit => done(result({ statements: [...statements, ...exit.value.statements], exit: exit.value.exit },
                tail || exit.tail, base || exit.base)))
        }
        const statement = block.statements[index]
        // A self alias is an established lexical read with no evaluation work.
        // Collapse its references as well: a now-unused alias must not make an
        // extracted loop helper capture a self slot that its graph never reads.
        if (statement[0] === 'define' && _isSelf(statement[2], aliases)) {
            return each(index + 1, [...aliases, statement[1]], statements, tail, base)
        }
        return bind(statementTask(statement, local), mapped => each(index + 1, aliases,
            [...statements, mapped.value], tail || mapped.tail, base || mapped.base))
    })
    return each(0, context.aliases, [], false, false)
}

/**
 * The root target is construction-local provenance, retained across completion
 * transport. No helper-shape recognition or serialized graph metadata is needed.
 * Functions without a self tail call crossing a loop retain their identity.
 * @type {(fn: FastFunction) => { readonly fn: FastFunction; readonly root: Loop | null }}
 */
export const _owningTailCalls = fn => {
    if (fn.self === null) { return { fn, root: null } }
    /** @type {LoopTarget} */
    const target = { kind: 'loop', index: fn.target.index }
    /** @type {_Context} */
    const context = { owner: fn.target, target, aliases: [fn.self], insideLoop: false, length: fn.parameters.length, rest: fn.rest !== null }
    const body = run(blockTask(fn.body, context, false))
    if (!body.tail) { return { fn, root: null } }
    const parameters = fn.parameters.map(binding => ({ index: binding.index }))
    const rest = fn.rest === null ? null : { index: fn.rest.index }
    /** @type {BindingId} */
    const result = { index: target.index }
    /** @type {Loop} */
    const loop = { target, parameters: [...fn.parameters, ...fn.rest === null ? [] : [fn.rest]],
        initial: [...parameters, ...rest === null ? [] : [rest]].map(binding => ['ref', binding]), results: body.base ? [result] : [], body: body.value }
    return { fn: { ...fn, parameters, rest, body: body.base
        ? { statements: [['loop', loop]], exit: ['return', fn.target, ['ref', result]] }
        : { statements: [], exit: ['loop', loop] } }, root: loop }
}
