/**
 * Source-output admission after common graph placement. Runtime output accepts
 * more graphs; source output must spell forms the current parser reads back.
 * This pass consumes one checked analysis and its normalized FAST result. It
 * chooses no bindings, regions, loop state or target syntax.
 *
 * @module
 * @import { Analysis, Node, Operand, Step } from '../../analysis/types.ts'
 * @import { Block, Definition, Value } from '../../../js/ast/types.ts'
 * @import { Refusal } from './types.ts'
 * @import { Task } from './private.ts'
 */

import { itemOperand, operandsOf } from '../../analysis/module.f.js'
import { operatorOperands } from '../../../js/ast/module.f.js'
import { exitValues } from '../../../js/ast/control/module.f.js'
import { prohibitedAccess } from '../../../js/prototype/module.f.js'
import { hasEntry } from '../../../types/object/entry/module.f.js'
import { fromValues, has, size } from '../../../types/set/module.f.js'

/** @type {(a: Analysis, key: Operand, method: boolean) => string | null} */
const keyReason = (a, key, method) => {
    if (typeof key === 'string') {
        const why = prohibitedAccess(method)(key)
        return why === null ? null : `a ${method ? 'call' : 'read'} of the prohibited ${why} "${key}"`
    }
    if (typeof key === 'number') { return Number.isFinite(key) && !Object.is(key, -0) ? null : 'a number key no literal reads back' }
    const node = key instanceof Array ? a.nodes[Number(key[1])] : null
    if (node === null || node[0] !== 'Number') { return 'an access key that is no literal' }
    return a.shared.includes(/** @type {readonly ['#', number]} */ (key)[1]) ? 'a shared computed key' : null
}

/** @type {(step: Step | undefined) => boolean} */
const callStep = step => step !== undefined && step[0] !== '|.'

/** A graph key holds a conversion operand, not a separate source expression. @type {(a: Analysis, key: Operand) => readonly Operand[]} */
const keyValues = (a, key) => {
    const node = key instanceof Array ? a.nodes[Number(key[1])] : null
    return node !== null && node[0] === 'Number' ? [node[1]] : []
}

/** Primitives have no identity key; invocation reads name the same value even as distinct nodes. @type {(a: Analysis, slot: Operand) => string | null} */
const captureKey = (a, slot) => {
    if (!(slot instanceof Array)) { return null }
    const node = a.nodes[Number(slot[1])]
    if (node[0] === 'undefined') { return null }
    return ['arg', 'rest', 'frame', 'self'].includes(node[0])
        ? `${node[0]}:${node[0] === 'arg' || node[0] === 'frame' || node[0] === 'self' && node.length === 2 ? node[1] : 0}`
        : `node:${slot[1]}`
}

/** @type {(a: Analysis, index: number, slots: readonly Operand[]) => string | null} */
const captureReason = (a, index, slots) => {
    const names = slots.map(slot => captureKey(a, slot)).filter(key => key !== null)
    if (size(fromValues(names)) !== names.length) { return 'a frame slot that repeats another' }
    return slots.some((_, k) => !a.nodes.some((read, j) => a.scope[Number(j)] === index && read[0] === 'frame' && read[1] === k)) ? 'a frame slot the body never reads' : null
}

/** The graph-specific restrictions which survive the common migration, with the node each is refused at. @type {(a: Analysis, module: boolean) => Refusal | null} */
const graphRefusal = (a, module) => {
    const shared = fromValues(a.shared)
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
        if (has(index)(shared)) {
            if (seen.some(([i, module]) => i === index && module === current.module)) { pending = rest; continue }
            seen = [...seen, [index, current.module]]
        }
        const node = a.nodes[Number(index)]
        if (node[0] === 'args') { return ['a args node', a.exps[Number(index)]] }
        if (node[0] === 'memberPresent') { return ['an internal member-presence query', a.exps[Number(index)]] }
        if (node[0] === ',') {
            if (node[1].length < 2) { return ['a comma with fewer than two operands', a.exps[Number(index)]] }
            if (!current.module && node[1].slice(0, -1).some(value => value instanceof Array && ['rest', 'arg', 'frame', 'self'].includes(a.nodes[Number(value[1])][0]))) { return ['an anchor that is a name', a.exps[Number(index)]] }
            pending = [...node[1].map(value => ({ value, module: current.module })), ...rest]
            continue
        }
        if (node[0] === '=>' || node[0] === 'group') {
            const slots = node[0] === '=>' ? node[2] : node[1]
            const why = captureReason(a, index, slots)
            if (why !== null) { return [why, a.exps[Number(index)]] }
            const bodies = node[0] === '=>' ? [node[3]] : node[2].map(([, body]) => body)
            pending = [...[...slots, ...bodies].map(value => ({ value, module: false })), ...rest]
            continue
        }
        if (node[0] === '.' || node[0] === '?.' || node[0] === '?.()') {
            const head = node[0] === '?.()' ? null : keyReason(a, node[2], callStep(node[3]))
            if (head !== null) { return [head, a.exps[Number(index)]] }
            let lazy = node[0] !== '.'
            const initialModule = !lazy && current.module
            /** @type {readonly { value: Operand, module: boolean }[]} */
            let children = [
                { value: node[1], module: current.module },
                ...(node[0] === '?.()' ? node[2].map(itemOperand) : keyValues(a, node[2])).map(value => ({ value, module: initialModule })),
            ]
            let step = node[3]
            while (step !== undefined) {
                lazy = lazy || step[0] === '|?.()'
                if (step[0] === '|.') {
                    const why = keyReason(a, step[1], callStep(step[2]))
                    if (why !== null) { return [why, a.exps[Number(index)]] }
                }
                const values = step[0] === '|.' ? keyValues(a, step[1]) : step[1].map(itemOperand)
                const stepModule = !lazy && current.module
                children = [...children, ...values.map(value => ({ value, module: stepModule }))]
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
 * The recipe's binding carries its entry's index, where it is an entry's,
 * and the entry its node.
 * @type {(a: Analysis, fast: Block) => Refusal | null}
 */
const lazyRefusal = (a, fast) => {
    /** @type {readonly Task[]} */
    let pending = [{ block: fast }]
    while (pending.length !== 0) {
        const [task, ...rest] = pending
        if (hasEntry(task, 'block')) {
            const { block } = task
            const lazy = block.statements.find(statement => statement[0] === 'define' && statement[3] === 'lazy')
            if (lazy !== undefined) {
                const { index } = /** @type {Definition} */ (lazy)[1]
                return ['a shared node reached from outside the lazy operand that establishes it', a.exps[Number(index)] ?? null]
            }
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

/**
 * Source admission over the same checked graph and placement result: why the
 * graph has no source spelling, and the node it is refused at where there is
 * one, for a caller that can say where that node came from.
 *
 * @type {(a: Analysis, fast: Block, module?: boolean) => Refusal | null}
 */
export const sourceRefusal = (a, fast, module = false) => graphRefusal(a, module) ?? lazyRefusal(a, fast)

/** The reason of {@link sourceRefusal} alone. @type {(a: Analysis, fast: Block, module?: boolean) => string | null} */
export const sourceReason = (a, fast, module = false) => {
    const refusal = sourceRefusal(a, fast, module)
    return refusal === null ? null : refusal[0]
}
