/**
 * Recover normal statement results selected by an already established test.
 * Terminal arms keep their transfers; one following continuation consumes the
 * joined values. Required first demands retain their original execution order.
 *
 * @module
 * @import { BindingId, Block, Definition, Statement, Value } from '../../../js/ast/types.ts'
 * @import { Exp } from '../../types.ts'
 * @import { Task } from '../../../js/ast/task/types.ts'
 * @import { _Selected } from './private.ts'
 */

import { operatorOperands, mapOperator } from '../../../js/ast/module.f.mjs'
import { exitValues, freeBindings } from '../../../js/ast/control/module.f.mjs'
import { bind, call, done, run } from '../../../js/ast/task/module.f.js'
import { _forwardResult } from '../../../js/ast/results/module.f.js'
import { anchored, lowerValue } from '../../from_fast/module.f.mjs'
import { demandsInOrder } from '../../demand/module.f.mjs'

/** Exact binding reads name an established test, independently of syntax identity. @type {(a: Value, b: Value) => boolean} */
const sameTest = (a, b) => a instanceof Array && b instanceof Array && a[0] === 'ref' && b[0] === 'ref' && a[1] === b[1]

/** Expand deferred recipes without evaluating them; established reads alone are inert placeholders. @type {(value: Value, target: BindingId, deferred: readonly Definition[]) => boolean} */
const firstDemand = (value, target, deferred) => {
    const definitions = deferred.filter(definition => definition[1] !== target)
    const bindings = freeBindings({ statements: definitions, exit: ['yield', [value]] })
    const wanted = /** @type {Exp} */ (['()', ['arg', bindings.length], []])
    /** @type {import('../../from_fast/types.ts').Environment} */
    let environment = bindings.map((binding, index) => [binding, binding === target ? wanted : ['arg', index]])
    for (const definition of definitions) {
        environment = [...environment, [definition[1], anchored(lowerValue(definition[2], environment))]]
    }
    return demandsInOrder(anchored(lowerValue(value, environment)), [wanted])
}

/** Deferred declarations run only at a read; dependency checks follow those reads through recipes. @type {(block: Block, target: BindingId, deferred: readonly Definition[]) => boolean} */
const references = (block, target, deferred) => {
    let pending = freeBindings(block)
    /** @type {readonly BindingId[]} */
    let seen = []
    while (pending.length !== 0) {
        const [binding, ...rest] = pending
        pending = rest
        if (binding === target) { return true }
        if (seen.includes(binding)) { continue }
        seen = [...seen, binding]
        const definition = deferred.find(definition => definition[1] === binding)
        if (definition !== undefined) { pending = [...freeBindings({ statements: [], exit: ['yield', [definition[2]]] }), ...pending] }
    }
    return false
}

/** Values remain in their operand region until the complete prefix proves a move. @type {(value: Value, test: Value, result: BindingId) => Task<_Selected | null>} */
const selectedTask = (value, test, result) => call(() => {
    if (!(value instanceof Array) || value[0] === 'ref' || value[0] === 'function') { return done(null) }
    if (value[0] === 'block') {
        const block = value[1]
        const first = block.statements[0]
        const operand = first === undefined && block.exit[0] === 'yield' ? block.exit[1][0]
            : first !== undefined && first[0] === 'define' && first[3] === 'required' ? first[2] : null
        if (operand === null) { return done(null) }
        return bind(selectedTask(operand, test, result), selected => done(selected === null ? null : /** @type {_Selected} */ ({ ...selected, value: ['block', first === undefined
            ? { statements: [], exit: ['yield', [selected.value]] }
            : { ...block, statements: [['define', first[1], selected.value, 'required'], ...block.statements.slice(1)] }],
        })))
    }
    if (value[0] === 'if') { return done(sameTest(value[1], test) ? { value: ['ref', result], then: value[2], otherwise: value[3] } : null) }
    const operands = operatorOperands(value)
    /** @type {(index: number) => Task<_Selected | null>} */
    const each = index => call(() => index === operands.length ? done(null)
        : bind(selectedTask(operands[index], test, result), selected => selected === null ? each(index + 1)
            : done(/** @type {_Selected} */ ({ ...selected, value: mapOperator((operand, position) => position === index ? selected.value : operand)(value) }))))
    return each(0)
})

/** A value arm executes only after the preceding statement arm completes normally. @type {(body: Block, value: Block) => Block} */
const yielded = (body, value) => body.exit[0] === 'yield' ? {
    statements: body.statements,
    exit: ['yield', [...body.exit[1], value.statements.length === 0 && value.exit[0] === 'yield' ? value.exit[1][0] : ['block', value]]],
} : body

/** An existing statement result is available only after both arms finish. @type {(results: readonly BindingId[], left: Block, right: Block) => boolean} */
const usesResults = (results, left, right) => [...freeBindings(left), ...freeBindings(right)].some(binding => results.includes(binding))

/** Only move a recipe to its first reached demand; earlier work remains before it. @type {(body: Block, definition: Definition, deferred: readonly Definition[]) => Block | null} */
const localized = (body, definition, deferred) => {
    let index = 0
    while (index < body.statements.length && !freeBindings({ statements: [body.statements[index]], exit: ['yield', []] }).includes(definition[1])) {
        index = index + 1
    }
    const statement = body.statements[index]
    const value = statement === undefined ? /** @type {Value} */ (['array', exitValues(body.exit)])
        : statement[0] === 'define' && statement[3] === 'required' || statement[0] === 'if' ? statement[2]
            : statement[0] === 'loop' ? /** @type {Value} */ (['array', statement[1].initial]) : null
    const visible = /** @type {readonly Definition[]} */ ([...deferred, ...body.statements.slice(0, index).flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
    if (value === null || !firstDemand(value, definition[1], visible)) { return null }
    return { ...body, statements: [...body.statements.slice(0, index), ['define', definition[1], definition[2], 'required'], ...body.statements.slice(index)] }
}

/** Recipes depending on a recovered result remain deferred until that result exists. @type {(block: Block, branch: Extract<Statement, readonly ['if', ...unknown[]]>, deferred: readonly Definition[]) => readonly Statement[]} */
const followingRecipes = (block, branch, deferred) => {
    const index = block.statements.indexOf(branch)
    const before = block.statements.slice(0, index)
    const moved = before.filter(statement => statement[0] === 'define' && statement[3] === 'lazy'
        && branch[1].some(binding => references({ statements: [], exit: ['yield', [statement[2]]] }, binding, deferred)))
    return [...before.filter(statement => !moved.includes(statement)), branch, ...moved, ...block.statements.slice(index + 1)]
}

/** Selected arms and the following normal continuation retain one first-demand owner. @type {(block: Block, selected: Extract<Statement, readonly ['if', ...unknown[]]>, deferred: readonly Definition[]) => Block} */
const localRecipes = (block, selected, inherited) => {
    const visible = /** @type {readonly Definition[]} */ ([...inherited, ...block.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
    let statements = followingRecipes(block, selected, visible)
    let branch = selected
    for (const definition of statements.toReversed()) {
        if (definition[0] !== 'define' || definition[3] !== 'lazy') { continue }
        const deferred = /** @type {readonly Definition[]} */ ([...inherited, ...statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
        const following = localized({ ...block, statements: statements.filter(statement => statement !== definition) }, definition, deferred)
        if (following !== null) { statements = following.statements; continue }
        const outside = /** @type {Block} */ ({ statements: statements.filter(statement => statement !== definition && statement !== branch), exit: block.exit })
        if (freeBindings(outside).includes(definition[1]) || freeBindings({ statements: [], exit: ['yield', [branch[2]]] }).includes(definition[1])) { continue }
        const left = freeBindings(branch[3]).includes(definition[1])
        const right = freeBindings(branch[4]).includes(definition[1])
        if (left === right) { continue }
        const body = localized(branch[left ? 3 : 4], definition, deferred)
        if (body === null) { continue }
        const previous = branch
        branch = ['if', branch[1], branch[2], left ? body : branch[3], right ? body : branch[4]]
        statements = statements.filter(statement => statement !== definition).map(statement => statement === previous ? branch : statement)
    }
    return { ...block, statements }
}

/**
 * Prefix recipes reference already available bindings. Dependent declarations
 * follow each recovered result before another recipe is considered.
 * @type {(block: Block, deferred: readonly Definition[], inherited: readonly Definition[]) => Block | null}
 */
const recipeJoin = (block, deferred, inherited) => {
    for (let index = block.statements.length - 1; index >= 0; index = index - 1) {
        const branch = block.statements[index]
        if (branch[0] !== 'if') { continue }
        for (const definition of block.statements.slice(0, index)) {
            if (definition[0] !== 'define' || definition[3] !== 'lazy') { continue }
            const value = definition[2]
            if (!(value instanceof Array) || value[0] !== 'if' || !sameTest(value[1], branch[2])) { continue }
            const earlier = /** @type {Block} */ ({ statements: block.statements.slice(0, index + 1).filter(statement => statement[0] !== 'define' || statement[3] !== 'lazy'), exit: ['yield', []] })
            if (references(earlier, definition[1], deferred)) { continue }
            const following = block.statements.slice(index + 1).find(statement => statement[0] !== 'define' || statement[3] !== 'lazy')
            const first = following === undefined ? /** @type {Value} */ (['array', exitValues(block.exit)])
                : following[0] === 'define' ? following[2] : null
            if (first === null || !firstDemand(first, definition[1], deferred)) { continue }
            const joined = /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (['if', [...branch[1], definition[1]], branch[2], yielded(branch[3], value[2]), yielded(branch[4], value[3])])
            return localRecipes({ ...block, statements: block.statements.filter(statement => statement !== definition).map(statement => statement === branch ? joined : statement) }, joined, inherited)
        }
    }
    return null
}

/** Rejoin a residual selected value without copying its following computation. @type {(block: Block, inherited: readonly Definition[]) => Task<Block>} */
const joinTask = (block, inherited) => call(() => {
    const deferred = /** @type {readonly Definition[]} */ ([...inherited, ...block.statements.flatMap(statement => statement[0] === 'define' && statement[3] === 'lazy' ? [statement] : [])])
    const recipe = recipeJoin(block, deferred, inherited)
    if (recipe !== null) { return joinTask(recipe, inherited) }
    const branch = block.statements.at(-1)
    if (branch === undefined || branch[0] !== 'if') { return done(block) }
    const result = /** @type {BindingId} */ ({ index: 0 })
    const values = exitValues(block.exit)
    return bind(selectedTask(['array', values], branch[2], result), selected => {
        if (selected === null || usesResults(branch[1], selected.then, selected.otherwise) || !firstDemand(selected.value, result, deferred)) { return done(block) }
        const joined = /** @type {Statement} */ (['if', [...branch[1], result], branch[2], yielded(branch[3], selected.then), yielded(branch[4], selected.otherwise)])
        const replacement = /** @type {Extract<Value, readonly ['array', unknown]>} */ (selected.value)[1]
        const exit = block.exit
        const mapped = /** @type {Block['exit']} */ (exit[0] === 'yield' ? ['yield', replacement]
            : exit[0] === 'break' || exit[0] === 'continue' ? [exit[0], exit[1], replacement]
                : exit[0] === 'return' ? ['return', exit[1], replacement[0]] : ['throw', replacement[0]])
        return bind(joinTask(localRecipes({ statements: [...block.statements.slice(0, -1), joined], exit: mapped }, /** @type {Extract<Statement, readonly ['if', ...unknown[]]>} */ (joined), inherited), inherited), done)
    })
})

/** Statement regions share the existing explicit task stack; function bodies were planned separately. @type {(block: Block, inherited?: readonly Definition[]) => Task<Block>} */
const blockTask = (block, inherited = []) => {
    /** @type {(index: number, statements: readonly Statement[], deferred?: readonly Definition[]) => Task<Block>} */
    const each = (index, statements, deferred = inherited) => call(() => {
        if (index === block.statements.length) {
            const exit = block.exit
            return exit[0] === 'loop'
                ? bind(blockTask(exit[1].body, deferred), body => done({ statements, exit: ['loop', { ...exit[1], body }] }))
                : joinTask({ ...block, statements }, inherited)
        }
        const statement = block.statements[index]
        if (statement[0] === 'define') { return each(index + 1, [...statements, statement], statement[3] === 'lazy' ? [...deferred, statement] : deferred) }
        if (statement[0] === 'loop') { return bind(blockTask(statement[1].body, deferred), body => each(index + 1, [...statements, ['loop', { ...statement[1], body }]], deferred)) }
        if (statement[0] === 'block') { return bind(blockTask(statement[2], deferred), body => each(index + 1, [...statements, _forwardResult(['block', statement[1], body])], deferred)) }
        return bind(blockTask(statement[3], deferred), left => bind(blockTask(statement[4], deferred), right => each(index + 1, [...statements, ['if', statement[1], statement[2], left, right]], deferred)))
    })
    return each(0, [])
}

/** Recover selected normal results after common tail-control placement. @type {(block: Block) => Block} */
export const _joinResults = block => run(blockTask(block))
