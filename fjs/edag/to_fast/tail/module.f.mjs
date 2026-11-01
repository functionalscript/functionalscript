/**
 * Tail status belongs to the terminal evaluation after value placement.
 * Required definitions and nonterminal result reads keep their evaluation
 * owner. An exclusively terminal lazy recipe has one following control region.
 *
 * @module
 * @import { BindingId, Block, LoopTarget, Statement, Value } from '../../../js/ast/types.ts'
 * @import { Task } from '../../../js/ast/task/types.ts'
 * @import { _Recipe, _Result, _Use, _UseTask } from './private.ts'
 */

import { bind, call, done, run } from '../../../js/ast/task/module.f.js'
import { isSpread, operatorOperands } from '../../../js/ast/module.f.mjs'
import { exitValues } from '../../../js/ast/control/module.f.mjs'
import { _restTransition } from '../../../js/ast/invocation/module.f.js'

/** @type {(value: Value, owner: BindingId | null, tail: boolean) => _UseTask} */
const valueTask = (value, owner, tail) => ({ kind: 'value', value, owner, tail })
/** @type {(block: Block, owner: BindingId | null, tail: boolean) => _UseTask} */
const blockTask = (block, owner, tail) => ({ kind: 'block', block, owner, tail })

/** Terminal uses retain their lazy recipe owner until that recipe is selected. @type {(source: Block) => readonly _Use[]} */
const recipeUses = source => {
    /** @type {readonly _UseTask[]} */
    let pending = [{ kind: 'block', block: source, owner: null, tail: true }]
    /** @type {readonly _Use[]} */
    let uses = []
    while (pending.length !== 0) {
        const [task, ...rest] = pending
        pending = rest
        const { owner } = task
        if (task.kind === 'block') {
            const { block } = task
            const tail = task.tail && block.exit[0] === 'yield' && block.exit[1].length === 1
            const terminal = block.exit[0] === 'loop' ? [blockTask(block.exit[1].body, owner, false)] : []
            pending = [...block.statements.map(statement => /** @type {_UseTask} */ ({ kind: 'statement', statement, owner })),
                ...exitValues(block.exit).map(value => valueTask(value, owner, tail)), ...terminal, ...pending]
            continue
        }
        if (task.kind === 'statement') {
            const statement = task.statement
            if (statement[0] === 'define') {
                pending = [valueTask(statement[2], statement[3] === 'lazy' ? statement[1] : owner, statement[3] === 'lazy'), ...pending]
            } else if (statement[0] === 'block') { pending = [blockTask(statement[2], owner, false), ...pending] }
            else if (statement[0] === 'if') {
                pending = [valueTask(statement[2], owner, false), blockTask(statement[3], owner, false), blockTask(statement[4], owner, false), ...pending]
            } else {
                pending = [...statement[1].initial.map(value => valueTask(value, owner, false)), blockTask(statement[1].body, owner, false), ...pending]
            }
            continue
        }
        const { value } = task
        if (!(value instanceof Array)) { continue }
        if (value[0] === 'ref') { uses = [...uses, { binding: value[1], owner, tail: task.tail }]; continue }
        if (value[0] === 'block') { pending = [blockTask(value[1], owner, task.tail), ...pending]; continue }
        if (value[0] === 'if') {
            pending = [valueTask(value[1], owner, false), blockTask(value[2], owner, task.tail), blockTask(value[3], owner, task.tail), ...pending]
            continue
        }
        pending = value[0] === 'function'
            ? [...value[1].captures.map(capture => valueTask(capture.value, owner, false)), blockTask(value[1].body, owner, false), ...pending]
            : [...operatorOperands(value).map(value => valueTask(value, owner, false)), ...pending]
    }
    return uses
}

/**
 * A single shared following recipe keeps one physical continuation. Exclusive
 * lazy dependencies move with it, without demanding or copying their values.
 * Independent interleaved recipes retain their existing recursive layout.
 * @type {(source: Block) => Task<{ readonly block: Block; readonly recipe: _Recipe } | null>}
 */
const recipeTask = source => call(() => {
    const definitions = /** @type {readonly _Recipe[]} */ (source.statements.filter(statement => statement[0] === 'define' && statement[3] === 'lazy'))
    if (definitions.length === 0) { return done(null) }
    const uses = recipeUses(source)
    const reads = definitions.map(definition => uses.filter(use => use.binding === definition[1]))
    const roots = definitions.filter((_, index) => reads[index].length !== 0 && reads[index].every(use => use.tail && use.owner === null))
    if (roots.length !== 1) { return done(null) }
    const root = roots[0]
    const owners = new Map(definitions.flatMap((definition, index) => {
        const first = reads[index][0]
        return first !== undefined && first.tail && first.owner !== null && definitions.some(definition => definition[1] === first.owner)
            && reads[index].every(use => use.tail && use.owner === first.owner) ? [/** @type {const} */ ([definition[1], first.owner])] : []
    }))
    /** @type {(binding: BindingId) => readonly _Recipe[]} */
    const childrenOf = binding => definitions.filter(child => owners.get(child[1]) === binding)
    /** @type {readonly BindingId[]} */
    let pending = [root[1]]
    /** @type {readonly BindingId[]} */
    let moved = []
    while (pending.length !== 0) {
        const [binding, ...rest] = pending
        moved = [...moved, binding]
        pending = [...childrenOf(binding).map(child => child[1]), ...rest]
    }
    const movedBindings = moved
    /** @type {(definition: _Recipe) => Task<_Recipe>} */
    const expand = definition => call(() => {
        const children = childrenOf(definition[1])
        /** @type {(index: number, statements: readonly Statement[]) => Task<_Recipe>} */
        const each = (index, statements) => call(() => index === children.length
            ? done(statements.length === 0 ? definition : ['define', definition[1], ['block', { statements, exit: ['yield', [definition[2]]] }], 'lazy'])
            : bind(expand(children[index]), statement => each(index + 1, [...statements, statement])))
        return each(0, [])
    })
    return bind(expand(root), recipe => done({ block: { ...source, statements: source.statements.filter(statement => statement[0] !== 'define' || !movedBindings.includes(statement[1])) }, recipe }))
})

/**
 * Convert reached terminal blocks and conditional arms. Other expressions
 * remain complete base results, including references to established calls.
 * Calls transition the fixed invocation signature. Missing values become
 * undefined; spreads and extra arguments finish evaluation before transfer.
 * Factoring a terminal base recipe can produce a one-pass loop with no backedge.
 * @type {(source: Block, parameters: readonly BindingId[], self: BindingId, target: LoopTarget, rest?: BindingId | null) => Block | null}
 */
export const _tailCalls = (source, parameters, self, target, rest = null) => {
    /** A selected recipe falls through; other leaves finish their original invocation. @type {(value: Value, selected: BindingId) => Task<Block>} */
    const selectedValueTask = (value, selected) => call(() => {
        if (value instanceof Array) {
            if (value[0] === 'ref' && value[1] === selected) { return done({ statements: [], exit: ['yield', []] }) }
            if (value[0] === 'block') { return selectedBlockTask(value[1], selected) }
            if (value[0] === 'if') {
                return bind(selectedBlockTask(value[2], selected), then => bind(selectedBlockTask(value[3], selected), otherwise => done({
                    statements: [['if', [], value[1], then, otherwise]], exit: ['yield', []],
                })))
            }
        }
        return bind(valueTask(value), result => done(result.block))
    })
    /** @type {(block: Block, selected: BindingId) => Task<Block>} */
    const selectedBlockTask = (block, selected) => call(() => block.exit[0] === 'throw' || block.exit[0] === 'loop' ? done(block)
        : bind(selectedValueTask(/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (block.exit)[1][0], selected), result =>
            done({ statements: [...block.statements, ...result.statements], exit: result.exit })))
    /** @type {(value: Value) => Task<_Result>} */
    const valueTask = value => call(() => {
        if (value instanceof Array) {
            if (value[0] === 'block') { return blockTask(value[1]) }
            if (value[0] === 'if') {
                return bind(blockTask(value[2]), then => bind(blockTask(value[3]), otherwise => done({
                    block: {
                        statements: [['if', [], value[1], then.block, otherwise.block]],
                        // Both arms transfer; an empty unreachable yield emits
                        // no physical suffix after the terminal conditional.
                        exit: ['yield', []],
                    },
                    changed: then.changed || otherwise.changed,
                })))
            }
            if (value[0] === '()' && value[1] instanceof Array && value[1][0] === 'ref' && value[1][1] === self) {
                const args = value[2]
                if (rest !== null) { return done({ block: _restTransition(parameters.length, args, target), changed: true }) }
                if (args.length > parameters.length || args.some(isSpread)) {
                    // Materialize the invocation before reading its fixed
                    // prefix. Every extra value and lazy demand stays reached.
                    // This private vector's identity is never exposed.
                    const binding = { index: self.index + 1 }
                    return done({ block: {
                        statements: [['define', binding, ['array', args], 'required']],
                        exit: ['continue', target, parameters.map((_, index) => ['.', ['ref', binding], index])],
                    }, changed: true })
                }
                const fixed = /** @type {readonly Value[]} */ (args)
                return done({ block: { statements: [], exit: ['continue', target, parameters.map((_, index) => index < fixed.length ? fixed[index] : undefined)] }, changed: true })
            }
        }
        return done({ block: { statements: [], exit: ['break', target, [value]] }, changed: false })
    })
    /** @type {(block: Block) => Task<_Result>} */
    const ordinaryBlockTask = block => call(() => {
        if (block.exit[0] === 'throw' || block.exit[0] === 'loop') {
            /** @type {_Result} */
            const result = { block, changed: false }
            return done(result)
        }
        return bind(valueTask(/** @type {Extract<Block['exit'], readonly ['yield', readonly Value[]]>} */ (block.exit)[1][0]), result => done({
            block: { statements: [...block.statements, ...result.block.statements], exit: result.block.exit }, changed: result.changed,
        }))
    })
    /** @type {(block: Block) => Task<_Result>} */
    const blockTask = block => bind(recipeTask(block), planned => planned === null ? ordinaryBlockTask(block)
        : bind(valueTask(planned.recipe[2]), continuation => bind(selectedBlockTask(planned.block, planned.recipe[1]), selected => done({
                block: { statements: [...selected.statements, ...continuation.block.statements], exit: continuation.block.exit },
                changed: true,
            }))))
    const result = run(blockTask(source))
    return result.changed ? result.block : null
}
