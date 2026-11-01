/**
 * Source-output admission after common graph placement. Runtime output accepts
 * more graphs; source output must spell forms the current parser reads back.
 * This pass consumes one checked analysis and its normalized FAST result. It
 * chooses no bindings, regions, loop state or target syntax.
 *
 * @module
 * @import { Analysis, Node, Operand, Step } from '../../analysis/types.ts'
 * @import { Block, Value } from '../../../js/ast/types.ts'
 * @import { Task } from './private.ts'
 */

import { itemOperand, operandsOf } from '../../analysis/module.f.mjs'
import { operatorOperands } from '../../../js/ast/module.f.mjs'
import { exitValues } from '../../../js/ast/control/module.f.mjs'
import { _prohibitedAccess } from '../../../compiler/parser/module.f.mjs'
import { hasEntry } from '../../../types/object/entry/module.f.js'

/** @type {(a: Analysis, key: Operand, method: boolean) => string | null} */
const keyReason = (a, key, method) => {
    if (typeof key === 'string') {
        const why = _prohibitedAccess(method)(key)
        return why === null ? null : `a prohibited ${why}`
    }
    if (typeof key === 'number') { return Number.isFinite(key) && !Object.is(key, -0) ? null : 'a number key no literal reads back' }
    const node = key instanceof Array ? a.nodes[key[1]] : null
    if (node === null || node[0] !== 'Number') { return 'an access key that is no literal' }
    return a.shared.includes(/** @type {readonly ['#', number]} */ (key)[1]) ? 'a shared computed key' : null
}

/** @type {(step: Step | undefined) => boolean} */
const callStep = step => step !== undefined && step[0] !== '|.'

/** A graph key holds a conversion operand, not a separate source expression. @type {(a: Analysis, key: Operand) => readonly Operand[]} */
const keyValues = (a, key) => {
    const node = key instanceof Array ? a.nodes[key[1]] : null
    return node !== null && node[0] === 'Number' ? [node[1]] : []
}

/** Captures of invocation reads name the same value even as distinct nodes. @type {(a: Analysis, slot: Operand) => string | null} */
const captureKey = (a, slot) => {
    if (!(slot instanceof Array)) { return null }
    const node = a.nodes[slot[1]]
    if (node[0] === 'undefined') { return null }
    return ['arg', 'rest', 'frame', 'self'].includes(node[0])
        ? `${node[0]}:${node[0] === 'arg' || node[0] === 'frame' ? node[1] : 0}`
        : `node:${slot[1]}`
}

/** @type {(a: Analysis, index: number, node: Extract<Node, readonly ['=>', ...unknown[]]>) => string | null} */
const captureReason = (a, index, node) => {
    const slots = node[2]
    const names = slots.map(slot => captureKey(a, slot))
    if (names.includes(null)) { return 'a frame slot holding a primitive' }
    if (new Set(names).size !== names.length) { return 'a frame slot that repeats another' }
    return slots.some((_, k) => !a.nodes.some((read, j) => a.scope[j] === index && read[0] === 'frame' && read[1] === k)) ? 'a frame slot the body never reads' : null
}

/** The graph-specific restrictions which survive the common migration. @type {(a: Analysis, module: boolean) => string | null} */
const graphReason = (a, module) => {
    const shared = new Set(a.shared)
    /** @type {readonly { value: Operand, module: boolean }[]} */
    let pending = [{ value: a.root, module }]
    /** @type {readonly (readonly [number, boolean])[]} */
    let seen = []
    while (pending.length !== 0) {
        const [current, ...rest] = pending
        const value = current.value
        if (!(value instanceof Array)) { pending = rest; continue }
        const index = value[1]
        // Only shared entries can repeat a path; ordinary chains need no cache.
        if (shared.has(index)) {
            if (seen.some(([i, module]) => i === index && module === current.module)) { pending = rest; continue }
            seen = [...seen, [index, current.module]]
        }
        const node = a.nodes[index]
        if (node[0] === 'args') { return 'a args node' }
        if (node[0] === 'memberPresent') { return 'an internal member-presence query' }
        if (node[0] === '+' && node.length === 2) { return 'a unary + node' }
        if (node[0] === ',') {
            if (node[1].length < 2) { return 'a comma with fewer than two operands' }
            if (!current.module && node[1].slice(0, -1).some(value => value instanceof Array && ['rest', 'arg', 'frame', 'self'].includes(a.nodes[value[1]][0]))) { return 'an anchor that is a name' }
            pending = [...node[1].map(value => ({ value, module: current.module })), ...rest]
            continue
        }
        if (node[0] === '=>') {
            const why = captureReason(a, index, node)
            if (why !== null) { return why }
            pending = [...node[2].map(value => ({ value, module: false })), { value: node[3], module: false }, ...rest]
            continue
        }
        if (node[0] === '.' || node[0] === '?.' || node[0] === '?.()') {
            const head = node[0] === '?.()' ? null : keyReason(a, node[2], callStep(node[3]))
            if (head !== null) { return head }
            let lazy = node[0] !== '.'
            /** @type {readonly { value: Operand, module: boolean }[]} */
            let children = [
                { value: node[1], module: current.module },
                ...(node[0] === '?.()' ? node[2].map(itemOperand) : keyValues(a, node[2])).map(value => ({ value, module: !lazy && current.module })),
            ]
            let step = node[3]
            while (step !== undefined) {
                lazy = lazy || step[0] === '|?.()'
                if (step[0] === '|.') {
                    const why = keyReason(a, step[1], callStep(step[2]))
                    if (why !== null) { return why }
                }
                const values = step[0] === '|.' ? keyValues(a, step[1]) : step[1].map(itemOperand)
                children = [...children, ...values.map(value => ({ value, module: !lazy && current.module }))]
                step = step[2]
            }
            pending = [...children, ...rest]
            continue
        }
        const lazy = node[0] === '?:'
        pending = [...operandsOf(node).map((value, index) => ({ value, module: current.module && !(lazy && index !== 0) })), ...rest]
    }
    return null
}

/** @type {(block: Block) => readonly Value[]} */
const blockValues = block => [
    ...block.statements.flatMap(statement => statement[0] === 'define' ? [statement[2]] : statement[0] === 'if' ? [statement[2]] : statement[0] === 'loop' ? statement[1].initial : []),
    ...exitValues(block.exit),
]

/**
 * Common placement splits source-spellable pure sharing. Every remaining lazy
 * definition needs memo storage, which current source cannot express. Admission
 * consumes that decision instead of repeating the graph's placement analysis.
 * @type {(fast: Block) => string | null}
 */
const lazyReason = fast => {
    /** @type {readonly Task[]} */
    let pending = [{ block: fast }]
    while (pending.length !== 0) {
        const [task, ...rest] = pending
        if (hasEntry(task, 'block')) {
            const { block } = task
            if (block.statements.some(statement => statement[0] === 'define' && statement[3] === 'lazy')) { return 'a shared node reached from outside the lazy operand that establishes it' }
            const blocks = block.statements.flatMap(statement => statement[0] === 'block' ? [statement[2]] : statement[0] === 'if' ? [statement[3], statement[4]] : statement[0] === 'loop' ? [statement[1].body] : [])
            const terminal = block.exit[0] === 'loop' ? [block.exit[1].body] : []
            pending = [...blocks.map(block => ({ block })), ...terminal.map(block => ({ block })), ...blockValues(block).map(value => ({ value })), ...rest]
            continue
        }
        const { value } = task
        if (!(value instanceof Array) || value[0] === 'ref') { pending = rest; continue }
        if (value[0] === 'function') { pending = [{ block: value[1].body }, ...value[1].captures.map(capture => ({ value: capture.value })), ...rest]; continue }
        if (value[0] === 'block') { pending = [{ block: value[1] }, ...rest]; continue }
        if (value[0] === 'if') { pending = [{ value: value[1] }, { block: value[2] }, { block: value[3] }, ...rest]; continue }
        pending = [...operatorOperands(value).map(value => ({ value })), ...rest]
    }
    return null
}

/** Source admission over the same checked graph and placement result. @type {(a: Analysis, fast: Block, module?: boolean) => string | null} */
export const sourceReason = (a, fast, module = false) => graphReason(a, module) ?? lazyReason(fast)
