/**
 * Carry enclosing returns and loop transfers through generated loop helpers.
 * Statement regions remain in the same source function; ordinary nested
 * functions and value operands are opaque to this pass. Normal-only loops and
 * a canonical invocation root keep their existing graph construction.
 *
 * @module
 *
 * @import { BindingId, Block, Exit, Function as FastFunction, FunctionTarget, Loop, LoopTarget, Statement, Value } from '../../../../js/ast/types.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { Link } from '../../private.ts'
 * @import { _BlockResult, _Flow, _InventoryTask, _LoopInfo, _TransferCase, _Visit } from './private.ts'
 */

import { assertNotNullish } from '../../../../asserts/module.f.js'
import { toArray } from '../../../../types/list/alt/module.f.js'

/** @type {_Flow} */
const noFlow = { returns: false, breaks: [], continues: [] }

/** @type {(exit: Exit, target: FunctionTarget | null) => _Flow} */
const exitFlow = (exit, target) => ({
    returns: exit[0] === 'return' && exit[1] === target,
    breaks: exit[0] === 'break' ? [exit[1]] : [],
    continues: exit[0] === 'continue' ? [exit[1]] : [],
})

/** @type {(left: _Flow, right: _Flow) => _Flow} */
const mergeFlow = (left, right) => ({
    returns: left.returns || right.returns,
    breaks: [...new Set([...left.breaks, ...right.breaks])],
    continues: [...new Set([...left.continues, ...right.continues])],
})

/**
 * Loop IDs follow lexical introduction order in the owning function or local
 * block. Values and ordinary functions do not contribute to this inventory.
 * The ancestor chain records resolved identities, independently of debug indices.
 * @type {(root: Block) => readonly _LoopInfo[]}
 */
const loopInventory = root => {
    /** @type {Link<_InventoryTask> | null} */
    let work = { first: { kind: 'block', block: root, ancestors: null }, tail: null }
    /** @type {List<_LoopInfo>} */
    let entries = null
    let count = 0
    while (work !== null) {
        const { first: task, tail } = /** @type {Link<_InventoryTask>} */ (work)
        work = tail
        if (task.kind === 'loop') {
            const info = /** @type {_LoopInfo} */ ({ loop: task.loop, id: count, ancestors: task.ancestors })
            ++count
            entries = { first: info, tail: entries }
            work = { first: { kind: 'block', block: task.loop.body, ancestors: { first: task.loop.target, tail: task.ancestors } }, tail: work }
            continue
        }
        const tasks = task.block.statements.flatMap(statement => statement[0] === 'block'
            ? [/** @type {_InventoryTask} */ ({ kind: 'block', block: statement[2], ancestors: task.ancestors })]
            : statement[0] === 'if' ? [
                /** @type {_InventoryTask} */ ({ kind: 'block', block: statement[3], ancestors: task.ancestors }),
                /** @type {_InventoryTask} */ ({ kind: 'block', block: statement[4], ancestors: task.ancestors }),
            ] : statement[0] === 'loop' ? [/** @type {_InventoryTask} */ ({ kind: 'loop', loop: statement[1], ancestors: task.ancestors })] : [])
        work = tasks.reduceRight((tail, first) => ({ first, tail }), work)
    }
    return toArray(entries).toReversed()
}

/** @type {(ancestors: Link<LoopTarget> | null, target: LoopTarget) => boolean} */
const isAncestor = (ancestors, target) => {
    let remaining = ancestors
    while (remaining !== null) {
        if (remaining.first === target) { return true }
        remaining = remaining.tail
    }
    return false
}

/** Stable target-ID order, with break before continue for one target. @type {(info: _LoopInfo, flow: _Flow, inventory: readonly _LoopInfo[]) => readonly _TransferCase[]} */
const transferCases = (info, flow, inventory) => inventory.flatMap(target => isAncestor(info.ancestors, target.loop.target) ? [
    ...(flow.breaks.includes(target.loop.target) ? [/** @type {_TransferCase} */ ({ kind: 'break', info: target })] : []),
    ...(flow.continues.includes(target.loop.target) ? [/** @type {_TransferCase} */ ({ kind: 'continue', info: target })] : []),
] : [])

/** @type {(block: Block, loops: boolean) => readonly Block[]} */
const childrenOf = (block, loops) => block.statements.flatMap(statement => statement[0] === 'block' ? [statement[2]]
    : statement[0] === 'if' ? [statement[3], statement[4]] : loops && statement[0] === 'loop' ? [statement[1].body] : [])

/**
 * A postorder worklist is shared by function-local normalization and the
 * narrower rewrite of one helper's exits. Each finish sees lexical child order.
 * @type {(root: Block, loops: boolean, finish: (block: Block, parts: readonly _BlockResult[]) => _BlockResult) => _BlockResult}
 */
const walk = (root, loops, finish) => {
    /** @type {Link<_Visit> | null} */
    let work = { first: { block: root, children: null }, tail: null }
    /** @type {Link<_BlockResult> | null} */
    let results = null
    while (work !== null) {
        const { first: visit, tail } = /** @type {Link<_Visit>} */ (work)
        work = tail
        const { block, children } = visit
        if (children === null) {
            const nested = childrenOf(block, loops)
            work = nested.reduceRight((tail, block) => ({ first: { block, children: null }, tail }),
                /** @type {Link<_Visit>} */ ({ first: { block, children: nested }, tail: work }))
            continue
        }
        /** @type {List<_BlockResult>} */
        let parts = null
        for (const _ of children) {
            /** @type {Link<_BlockResult>} */
            const part = assertNotNullish(results)
            results = part.tail
            parts = { first: part.first, tail: parts }
        }
        results = { first: finish(block, toArray(parts)), tail: results }
    }
    return assertNotNullish(results).first
}

/**
 * Only owning normal breaks, source returns and valid lexical escapes become
 * completion payloads. Nested loop bodies keep their own exit owner; foreign
 * or nonlexical targets remain raw for the graph constructor to refuse.
 * @type {(loop: Loop, target: FunctionTarget | null, cases: readonly _TransferCase[]) => Block}
 */
const encodedBody = (loop, target, cases) => walk(loop.body, false, (block, parts) => {
    let index = 0
    let changed = false
    /** @type {List<Statement>} */
    let reversed = null
    for (const statement of block.statements) {
        /** @type {Statement} */
        let mapped = statement
        if (statement[0] === 'block') {
            const part = parts[Number(index++)]
            if (part.block !== statement[2]) { changed = true; mapped = ['block', statement[1], part.block] }
        } else if (statement[0] === 'if') {
            const then = parts[Number(index++)].block
            const otherwise = parts[Number(index++)].block
            if (then !== statement[3] || otherwise !== statement[4]) { changed = true; mapped = ['if', statement[1], statement[2], then, otherwise] }
        }
        reversed = { first: mapped, tail: reversed }
    }
    const statements = toArray(reversed).toReversed()
    const exit = block.exit
    if (exit[0] === 'break' && exit[1] === loop.target) {
        return { block: { statements, exit: ['break', loop.target, [['array', ['normal', ['array', exit[2]]]]]] }, flow: noFlow }
    }
    if (exit[0] === 'return' && exit[1] === target) {
        return { block: { statements, exit: ['break', loop.target, [['array', ['return', exit[2]]]]] }, flow: noFlow }
    }
    if (exit[0] === 'break' || exit[0] === 'continue') {
        const found = cases.find(candidate => candidate.kind === exit[0] && candidate.info.loop.target === exit[1])
        if (found !== undefined) {
            return { block: { statements, exit: ['break', loop.target, [['array', [exit[0], found.info.id, ['array', exit[2]]]]]] }, flow: noFlow }
        }
    }
    return { block: changed ? { statements, exit } : block, flow: noFlow }
}).block

/** The ID is inspected only after the private completion kind matches. @type {(completion: BindingId, candidate: _TransferCase) => Value} */
const transferGuard = (completion, candidate) => ['if', ['===', ['.', ['ref', completion], 0], candidate.kind],
    { statements: [], exit: ['yield', [['===', ['.', ['ref', completion], 1], candidate.info.id]]] },
    { statements: [], exit: ['yield', [false]] },
]

/** Original loop signatures select payload slots before helper state packing. @type {(completion: BindingId, candidate: _TransferCase) => Block} */
const transferBlock = (completion, candidate) => ({
    statements: [],
    exit: [candidate.kind, candidate.info.loop.target,
        (candidate.kind === 'break' ? candidate.info.loop.results : candidate.info.loop.parameters)
            .map((_, i) => ['.', ['.', ['ref', completion], 2], i]),
    ],
})

/**
 * The outer dispatch alone declares the original result bindings. Additional
 * cases are zero-result statements which either transfer or fall through to
 * the normal yield. Return-only dispatch retains its established exact shape.
 * @type {(loop: Loop, target: FunctionTarget | null, returns: boolean, cases: readonly _TransferCase[]) => readonly Statement[]}
 */
const completedLoop = (loop, target, returns, cases) => {
    const completion = /** @type {const} */ ({ index: loop.target.index })
    const wrapped = /** @type {Loop} */ ({ ...loop, results: [completion], body: encodedBody(loop, target, cases) })
    const normal = /** @type {Block} */ ({
        statements: cases.slice(returns ? 0 : 1).map(candidate => ['if', [], transferGuard(completion, candidate), transferBlock(completion, candidate),
            { statements: [], exit: ['yield', []] }]),
        exit: ['yield', loop.results.map((_, i) => ['.', ['.', ['ref', completion], 1], i])],
    })
    return [
        ['loop', wrapped],
        ['if', loop.results, returns ? ['===', ['.', ['ref', completion], 0], 'return'] : transferGuard(completion, cases[0]),
            returns ? { statements: [], exit: ['return', assertNotNullish(target), ['.', ['ref', completion], 1]] } : transferBlock(completion, cases[0]),
            normal,
        ],
    ]
}

/**
 * @type {(block: Block, target: FunctionTarget | null, root: Loop | null) => Block}
 */
const completeBlock = (block, target, root) => {
    const inventory = loopInventory(block)
    const byTarget = new Map(inventory.map(info => [info.loop.target, info]))
    const result = walk(block, true, (block, parts) => {
        let index = 0
        let changed = false
        let flow = exitFlow(block.exit, target)
        /** @type {List<Statement>} */
        let statements = null
        for (const statement of block.statements) {
            /** @type {readonly Statement[]} */
            let added = [statement]
            if (statement[0] === 'block') {
                const part = parts[Number(index++)]
                flow = mergeFlow(flow, part.flow)
                if (part.block !== statement[2]) { changed = true; added = [['block', statement[1], part.block]] }
            } else if (statement[0] === 'if') {
                const then = parts[Number(index++)]
                const otherwise = parts[Number(index++)]
                flow = mergeFlow(mergeFlow(flow, then.flow), otherwise.flow)
                if (then.block !== statement[3] || otherwise.block !== statement[4]) {
                    changed = true
                    added = [['if', statement[1], statement[2], then.block, otherwise.block]]
                }
            } else if (statement[0] === 'loop') {
                const part = parts[Number(index++)]
                const loop = part.block === statement[1].body ? statement[1] : { ...statement[1], body: part.block }
                const outgoing = /** @type {_Flow} */ ({
                    returns: part.flow.returns,
                    breaks: part.flow.breaks.filter(target => target !== loop.target),
                    continues: part.flow.continues.filter(target => target !== loop.target),
                })
                flow = mergeFlow(flow, outgoing)
                const info = assertNotNullish(byTarget.get(loop.target))
                const cases = transferCases(info, outgoing, inventory)
                if ((outgoing.returns || cases.length !== 0) && statement[1] !== root) {
                    changed = true
                    added = completedLoop(loop, target, outgoing.returns, cases)
                } else if (loop !== statement[1]) { changed = true; added = [['loop', loop]] }
            }
            for (const first of added) { statements = { first, tail: statements } }
        }
        return { block: changed ? { statements: toArray(statements).toReversed(), exit: block.exit } : block, flow }
    })
    return result.block
}

/**
 * Normalize function-local statement completions. A canonical invocation root
 * remains unwrapped while its nested loops are visited. Normal-only functions
 * retain their original identity, preserving the scalar and direct-root domains.
 * @type {(fn: FastFunction, root: Loop | null) => FastFunction}
 */
export const completeTransfers = (fn, root) => {
    const body = completeBlock(fn.body, fn.target, root)
    return body === fn.body ? fn : { ...fn, body }
}

/**
 * Normalize local loop transfers before helper state packing. Without a source
 * function owner, returns stay raw; an enclosing target outside this block's
 * inventory also stays raw, preserving the operand-region boundary.
 * @type {(block: Block) => Block}
 */
export const completeBlockTransfers = block => completeBlock(block, null, null)
