/**
 * Retain loops admitted by shared source preparation and reify other canonical
 * invocation loops as recursive source. Placement and tail eligibility stay in
 * common FAST; the source adapter chooses no mutable state or target syntax.
 *
 * @module
 * @import { Block, Exit, Function as FastFunction, Loop, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { Result } from '../../../../types/result/types.ts'
 * @import { _Scope, _SourceTask as Task } from './private.ts'
 */

import { directInvocationRoot, invocationRootOf } from '../../../from_fast/loop/root/module.f.mjs'
import { scalarLoopOf } from '../../../../js/ast/loop/module.f.js'
import { branchingPlainLoopOf, continueFirstPlainLoopOf, plainLoopOf, resultBlockPlainLoopOf } from '../../../../js/ast/loop/plain/module.f.mjs'
import { isTerminalLoop } from '../../../../js/ast/loop/terminal/module.f.js'
import { exitValues } from '../../../../js/ast/control/module.f.mjs'
import { mapOperator, operatorOperands } from '../../../../js/ast/module.f.mjs'
import { bind as taskBind, call, done as taskDone, run } from '../../../../js/ast/task/module.f.js'
import { error, ok } from '../../../../types/result/module.f.js'

/** @type {<T>(value: T) => Task<T>} */
const done = value => taskDone(ok(value))

/** Preserve the first source-profile refusal through the existing task walk. @type {<T, U>(task: Task<T>, then: (value: T) => Task<U>) => Task<U>} */
const bind = (task, then) => taskBind(task, result => result[0] === 'error' ? taskDone(result) : then(result[1]))

/**
 * The admitted structured loop keeps every loop transfer at its nearest loop.
 * Ordinary function bodies own their exits; construction captures and nested
 * loop initializers still run in the containing region. Statement returns exit
 * the enclosing function; a return cannot escape an emitted value region.
 * The earlier scalar profile keeps its arity limits. General invocation roots
 * use the same lexical checks with common one-result state packing instead.
 * @type {(loop: Loop, general?: boolean) => boolean}
 */
const localLoop = (loop, general = false) => {
    if (!general && loop.parameters.length > 1) { return false }
    /** @type {readonly _Scope[]} */
    let pending = [{ kind: 'block', block: loop.body, target: loop.target, value: false }]
    while (pending.length !== 0) {
        const [scope, ...rest] = pending
        pending = rest
        const { target } = scope
        if (scope.kind === 'value') {
            const value = scope.value
            if (!(value instanceof Array) || value[0] === 'ref') { continue }
            if (value[0] === 'block') { pending = [{ kind: 'block', block: value[1], target, value: true }, ...pending]; continue }
            if (value[0] === 'if') {
                pending = [{ kind: 'value', value: value[1], target },
                    { kind: 'block', block: value[2], target, value: true },
                    { kind: 'block', block: value[3], target, value: true }, ...pending]
                continue
            }
            const operands = value[0] === 'function' ? value[1].captures.map(capture => capture.value) : operatorOperands(value)
            pending = [...operands.map(value => /** @type {_Scope} */ ({ kind: 'value', value, target })), ...pending]
            continue
        }
        const { block } = scope
        const exit = block.exit
        if (exit[0] === 'return' && scope.value
            || scope.value && (exit[0] === 'break' || exit[0] === 'continue')
            || !general && exit[0] === 'break' && exit[1] === loop.target && loop.parameters.length === 0
            || (exit[0] === 'break' || exit[0] === 'continue') && exit[1] !== target) { return false }
        pending = [...exitValues(exit).map(value => /** @type {_Scope} */ ({ kind: 'value', value, target })), ...pending]
        if (exit[0] === 'loop') {
            pending = [{ kind: 'block', block: exit[1].body, target: exit[1].target, value: scope.value }, ...pending]
        }
        for (const statement of block.statements) {
            if (statement[0] === 'define') { pending = [{ kind: 'value', value: statement[2], target }, ...pending] }
            else if (statement[0] === 'block') { return false }
            else if (statement[0] === 'if') {
                pending = [{ kind: 'value', value: statement[2], target },
                    { kind: 'block', block: statement[3], target, value: false },
                    { kind: 'block', block: statement[4], target, value: false }, ...pending]
            } else {
                pending = [...statement[1].initial.map(value => /** @type {_Scope} */ ({ kind: 'value', value, target })),
                    { kind: 'block', block: statement[1].body, target: statement[1].target, value: false }, ...pending]
            }
        }
    }
    return true
}

/** Keep source conditionals in value form; each tail arm supplies one result. @type {(block: Block) => Task<Block>} */
const resultBlock = block => call(() => {
    const last = block.statements.at(-1)
    if (block.statements.some((statement, index) => statement[0] !== 'define' && (statement[0] !== 'if' || index !== block.statements.length - 1))) {
        return taskDone(error('a factored terminal continuation outside the source loop profile'))
    }
    if (last !== undefined && last[0] === 'if') {
        return bind(resultBlock(last[3]), then => bind(resultBlock(last[4]), otherwise => done({
            statements: block.statements.slice(0, -1),
            exit: ['yield', [['if', last[2], then, otherwise]]],
        })))
    }
    const exit = block.exit
    if (exit[0] !== 'return' && exit[0] !== 'throw') { return taskDone(error('a factored terminal continuation outside the source loop profile')) }
    return done(exit[0] === 'throw' ? block : { statements: block.statements, exit: ['yield', [exit[2]]] })
})

/** Inverse aliases read established invocation inputs, captures and self. @type {(fn: FastFunction) => Task<FastFunction>} */
const recursiveFunction = fn => {
    const loop = invocationRootOf(fn)
    if (loop === null || plainLoopOf(loop) !== null || (fn.rest === null && (scalarLoopOf(loop) !== null || localLoop(loop)))) { return done(fn) }
    if (branchingPlainLoopOf(loop) !== null) { return done(fn) }
    const retained = fn.parameters.length === 0 && fn.rest !== null
        ? continueFirstPlainLoopOf(loop) ?? resultBlockPlainLoopOf(loop)
        : loop.parameters.length !== 1 ? resultBlockPlainLoopOf(loop) : null
    if (retained !== null) { return done({ ...fn, body: { ...fn.body,
        statements: [...fn.body.statements.slice(0, -1), ['loop', retained]],
    } }) }
    if (isTerminalLoop(loop)) { return done(fn) }
    // Keep existing source plans first. Their common one-result layout also
    // carries normal joins before a shared tail, without restoring recursion.
    if (localLoop(loop, true)) { return done(fn) }
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
    return bind(loopTask(source[1]), loop => done(loop === source[1] ? source : ['loop', loop]))
}))

/** Both statement and terminal loops keep the same entry and body transformations. @type {(loop: Loop) => Task<Loop>} */
const loopTask = loop =>
    bind(each(loop.initial, valueTask), initial => bind(blockTask(loop.body), body =>
        done(initial === loop.initial && body === loop.body ? loop : { ...loop, initial, body })))

/** @type {(source: Block) => Task<Block>} */
const blockTask = source => bind(each(source.statements, statementTask), statements => {
    const exit = source.exit
    if (exit[0] === 'loop') {
        return bind(loopTask(exit[1]), loop => done(statements === source.statements && loop === exit[1] ? source : { statements, exit: ['loop', loop] }))
    }
    return bind(each(exitValues(exit), valueTask), values => {
        if (statements === source.statements && values.every((value, index) => value === exitValues(exit)[index])) { return done(source) }
        /** @type {Exit} */
        const mapped = exit[0] === 'yield' ? ['yield', values]
            : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], values]
                : exit[0] === 'throw' ? ['throw', values[0]] : ['return', exit[1], values[0]]
        return done({ statements, exit: mapped })
    })
})

/** Source grammar preparation over the common placed plan. @type {(block: Block) => Result<Block, string>} */
export const _sourceLoops = block => run(blockTask(block))
