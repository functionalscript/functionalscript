/**
 * Reify canonical invocation loops as recursive source until the source grammar
 * admits general loops. Placement and tail eligibility stay in common FAST.
 * The established scalar loop keeps its existing source spelling.
 *
 * @module
 * @import { Block, Exit, Function as FastFunction, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Task } from '../../../../js/ast/task/types.ts'
 */

import { directInvocationRoot, invocationRootOf } from '../../../from_fast/loop/root/module.f.mjs'
import { scalarLoopOf } from '../../../../js/ast/loop/module.f.js'
import { exitValues } from '../../../../js/ast/control/module.f.mjs'
import { mapOperator, operatorOperands } from '../../../../js/ast/module.f.mjs'
import { bind, call, done, run } from '../../../../js/ast/task/module.f.mjs'
import { assert } from '../../../../asserts/module.f.js'

/** Keep source conditionals in value form; each tail arm supplies one result. @type {(block: Block) => Task<Block>} */
const resultBlock = block => call(() => {
    const last = block.statements.at(-1)
    if (last !== undefined && last[0] === 'if') {
        return bind(resultBlock(last[3]), then => bind(resultBlock(last[4]), otherwise => done({
            statements: block.statements.slice(0, -1),
            exit: ['yield', [['if', last[2], then, otherwise]]],
        })))
    }
    const exit = block.exit
    assert(exit[0] === 'return' || exit[0] === 'throw')
    return done(exit[0] === 'throw' ? block : { statements: block.statements, exit: ['yield', [exit[2]]] })
})

/** Inverse aliases read established invocation inputs, captures and self. @type {(fn: FastFunction) => Task<FastFunction>} */
const recursiveFunction = fn => {
    const loop = invocationRootOf(fn)
    if (loop === null || (fn.rest === null && scalarLoopOf(loop) !== null)) { return done(fn) }
    const recursive = directInvocationRoot(fn, loop)
    const aliasCount = fn.body.statements.length - 1 + loop.parameters.length
    const statements = recursive.body.statements.map((statement, index) => index < aliasCount
        ? /** @type {Statement} */ (['define', statement[1], /** @type {Extract<Statement, readonly ['define', ...unknown[]]>} */ (statement)[2], 'required']) : statement)
    return bind(resultBlock({ ...recursive.body, statements }), body => done({
        ...recursive,
        body: body.exit[0] === 'throw' ? body : { statements: body.statements, exit: ['return', fn.target, /** @type {Extract<Exit, readonly ['yield', readonly Value[]]>} */ (body.exit)[1][0]] },
    }))
}

/**
 * @template T
 * @param {readonly T[]} items
 * @param {(item: T) => Task<T>} visit
 * @returns {Task<readonly T[]>}
 */
const each = (items, visit) => {
    /** @type {(index: number, values: readonly T[]) => Task<readonly T[]>} */
    const next = (index, values) => call(() => index === items.length
        ? done(values.every((value, index) => value === items[index]) ? items : values)
        : bind(visit(items[index]), value => next(index + 1, [...values, value])))
    return next(0, [])
}

/** @type {(source: Value) => Task<Value>} */
const valueTask = source => call(/** @type {() => Task<Value>} */ (() => {
    if (!(source instanceof Array) || source[0] === 'ref') { return done(source) }
    if (source[0] === 'block') { return bind(blockTask(source[1]), block => done(block === source[1] ? source : ['block', block])) }
    if (source[0] === 'if') {
        return bind(valueTask(source[1]), test => bind(blockTask(source[2]), then => bind(blockTask(source[3]), otherwise =>
            done(test === source[1] && then === source[2] && otherwise === source[3] ? source : ['if', test, then, otherwise]))))
    }
    if (source[0] === 'function') {
        const fn = source[1]
        return bind(each(fn.captures, capture => bind(valueTask(capture.value), value => done(value === capture.value ? capture : { ...capture, value }))), captures =>
            bind(blockTask(fn.body), body => bind(recursiveFunction(captures === fn.captures && body === fn.body ? fn : { ...fn, captures, body }), prepared =>
                done(prepared === fn ? source : ['function', prepared]))))
    }
    const values = operatorOperands(source)
    return bind(each(values, valueTask), operands => done(operands === values ? source : mapOperator((_, index) => operands[index])(source)))
}))

/** @type {(source: Statement) => Task<Statement>} */
const statementTask = source => call(/** @type {() => Task<Statement>} */ (() => {
    if (source[0] === 'define') { return bind(valueTask(source[2]), value => done(value === source[2] ? source : ['define', source[1], value, source[3]])) }
    if (source[0] === 'block') { return bind(blockTask(source[2]), block => done(block === source[2] ? source : ['block', source[1], block])) }
    if (source[0] === 'if') {
        return bind(valueTask(source[2]), test => bind(blockTask(source[3]), then => bind(blockTask(source[4]), otherwise =>
            done(test === source[2] && then === source[3] && otherwise === source[4] ? source : ['if', source[1], test, then, otherwise]))))
    }
    const loop = source[1]
    return bind(each(loop.initial, valueTask), initial => bind(blockTask(loop.body), body =>
        done(initial === loop.initial && body === loop.body ? source : ['loop', { ...loop, initial, body }])))
}))

/** @type {(source: Block) => Task<Block>} */
const blockTask = source => bind(each(source.statements, statementTask), statements => bind(each(exitValues(source.exit), valueTask), values => {
    const exit = source.exit
    if (statements === source.statements && values.every((value, index) => value === exitValues(exit)[index])) { return done(source) }
    const mapped = /** @type {Exit} */ (exit[0] === 'yield' ? ['yield', values]
        : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values]
            : exit[0] === 'throw' ? ['throw', values[0]] : ['return', exit[1], values[0]])
    return done({ statements, exit: mapped })
}))

/** Source grammar preparation over the common placed plan. @type {(block: Block) => Block} */
export const _sourceLoops = block => run(blockTask(block))
