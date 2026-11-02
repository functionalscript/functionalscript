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
 * @import { BindingId, Block, Exit, Loop, LoopTarget, Value } from '../types.ts'
 * @import { _Context as Context, _Link as Link, _Task as Task } from './private.ts'
 */

import { operatorOperands } from '../module.f.mjs'

/** @type {(tasks: readonly Task[], tail: Link<Task> | null) => Link<Task> | null} */
const prepend = (tasks, tail) => tasks.reduceRight((tail, first) => ({ first, tail }), tail)

/** @type {(values: readonly Value[], context: Context) => readonly Task[]} */
const valueTasks = (values, context) => values.map(value => ({ kind: 'value', value, bound: context.bound }))

/** @type {(block: Block, context: Context) => Task} */
const blockTask = (block, context) => ({ kind: 'block', block, bound: context.bound })

/** Direct exit operands; a terminal loop's body is a separate lexical region. @type {(exit: Exit) => readonly Value[]} */
export const exitValues = exit => exit[0] === 'yield' ? exit[1]
    : exit[0] === 'loop' ? exit[1].initial
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
    const exit = block.exit
    return [...tasks, ...valueTasks(exitValues(exit), { bound: scope }),
        ...exit[0] === 'loop' ? [blockTask(exit[1].body, { bound: [...scope, ...exit[1].parameters] })] : []]
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

/**
 * Find a transfer to one exact loop target through values and statement
 * regions, including nested loops. Ordinary function bodies remain opaque;
 * their captures still execute in the constructing region.
 * An optional kind distinguishes an invocation backedge from a normal break.
 * @type {(root: Value | Block, target: LoopTarget, kind?: 'break' | 'continue') => boolean}
 */
export const hasLoopTransfer = (root, target, kind = undefined) => {
    /** @type {Link<Value | Block> | null} */
    let work = { first: root, tail: null }
    while (work !== null) {
        const { first: node, tail } = /** @type {Link<Value | Block>} */ (work)
        work = tail
        if (node === null || typeof node !== 'object') { continue }
        /** @type {readonly (Value | Block)[]} */
        let children
        if (node instanceof Array) {
            children = node[0] === 'ref' ? [] : node[0] === 'function' ? node[1].captures.map(capture => capture.value)
                : node[0] === 'block' ? [node[1]] : node[0] === 'if' ? [node[1], node[2], node[3]] : operatorOperands(node)
        } else {
            const exit = node.exit
            if ((exit[0] === 'continue' || exit[0] === 'break') && exit[1] === target && (kind === undefined || exit[0] === kind)) { return true }
            children = [...node.statements.flatMap(/** @returns {readonly (Value | Block)[]} */ statement => statement[0] === 'define' ? [statement[2]]
                : statement[0] === 'loop' ? [...statement[1].initial, statement[1].body]
                    : statement[0] === 'block' ? [statement[2]] : [statement[2], statement[3], statement[4]]), ...exitValues(exit),
                ...exit[0] === 'loop' ? [exit[1].body] : []]
        }
        work = children.reduceRight((tail, first) => ({ first, tail }), work)
    }
    return false
}
