/**
 * Lexical dependencies at generated helper boundaries. One
 * explicit-stack traversal preserves operand order without crossing ordinary
 * function bodies. Resolved identities remain distinct from printed indices.
 *
 * Free bindings describe dependencies, not eager capture placement. A free
 * lazy binding keeps its first-demand lifetime; graph construction threads
 * that invocation's memo state through helpers separately.
 *
 * @module
 *
 * @import { BindingId, Block, Exit, Loop, Value } from '../../../js/ast/types.ts'
 * @import { Context, Link, Task } from './private.ts'
 */

import { operatorOperands } from '../../../js/ast/module.f.mjs'

/** @type {(tasks: readonly Task[], tail: Link<Task> | null) => Link<Task> | null} */
const prepend = (tasks, tail) => tasks.reduceRight((tail, first) => ({ first, tail }), tail)

/** @type {(values: readonly Value[], context: Context) => readonly Task[]} */
const valueTasks = (values, context) => values.map(value => ({ kind: 'value', value, bound: context.bound }))

/** @type {(block: Block, context: Context) => Task} */
const blockTask = (block, context) => ({ kind: 'block', block, bound: context.bound })

/** @type {(exit: Exit) => readonly Value[]} */
const exitValues = exit => exit[0] === 'yield' ? exit[1]
    : exit[0] === 'break' || exit[0] === 'continue' ? exit[2]
    : exit[0] === 'throw' ? [exit[1]] : [exit[2]]

/**
 * Expand statements in lexical order. Each work item holds its immutable
 * scope snapshot, so sibling block locals never become caller bindings.
 *
 * @type {(block: Block, context: Context) => readonly Task[]}
 */
const blockTasks = (block, context) => {
    let scope = context.bound
    /** @type {readonly Task[]} */
    let tasks = []
    for (const statement of block.statements) {
        const inner = { bound: scope }
        if (statement[0] === 'define') {
            tasks = [...tasks, ...valueTasks([statement[2]], inner)]
            scope = [...scope, statement[1]]
            continue
        }
        if (statement[0] === 'loop') {
            const loop = statement[1]
            tasks = [...tasks, ...valueTasks(loop.initial, inner), blockTask(loop.body, { bound: [...scope, ...loop.parameters] })]
            scope = [...scope, ...loop.results]
            continue
        }
        tasks = [...tasks, ...(statement[0] === 'block' ? [blockTask(statement[2], inner)]
            : [...valueTasks([statement[2]], inner), blockTask(statement[3], inner), blockTask(statement[4], inner)])]
        scope = [...scope, ...statement[1]]
    }
    return [...tasks, ...valueTasks(exitValues(block.exit), { bound: scope })]
}

/**
 * Complete lexical facts in first-occurrence order. Nested functions expose
 * captures alone; loop entry values belong to the caller, parameters to the
 * loop body, and results to following statements. Syntactically present
 * branches remain represented without constant evaluation or liveness work.
 *
 * @type {(block: Block, bound?: readonly BindingId[]) => readonly BindingId[]}
 */
export const freeBindings = (block, bound = []) => {
    /** @type {Link<Task> | null} */
    let pending = { first: blockTask(block, { bound }), tail: null }
    /** @type {readonly BindingId[]} */
    let bindings = []
    while (pending !== null) {
        const { first: task, tail: rest } = /** @type {Link<Task>} */ (pending)
        if (task.kind === 'block') { pending = prepend(blockTasks(task.block, task), rest); continue }
        const { value } = task
        if (value === null || typeof value !== 'object') { pending = rest; continue }
        switch (value[0]) {
            case 'ref': {
                if (!task.bound.includes(value[1]) && !bindings.includes(value[1])) { bindings = [...bindings, value[1]] }
                pending = rest
                break
            }
            case 'function': { pending = prepend(valueTasks(value[1].captures.map(capture => capture.value), task), rest); break }
            case 'block': { pending = { first: blockTask(value[1], task), tail: rest }; break }
            case 'if': { pending = prepend([...valueTasks([value[1]], task), blockTask(value[2], task), blockTask(value[3], task)], rest); break }
            default: { pending = prepend(valueTasks(operatorOperands(value), task), rest) }
        }
    }
    return bindings
}

/** A loop helper's body dependencies; entry expressions belong to its caller. @type {(loop: Loop) => readonly BindingId[]} */
export const freeLoopBindings = loop => freeBindings(loop.body, loop.parameters)
