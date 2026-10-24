/**
 * Carry an enclosing function's returns through generated loop helpers.
 * Statement regions remain in the same source function; ordinary nested
 * functions and value operands are opaque to this pass. Normal-only loops and
 * a canonical invocation root keep their existing graph construction.
 *
 * @module
 *
 * @import { Block, Function as FastFunction, FunctionTarget, Loop, Statement } from '../../../../js/ast/types.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { Link } from '../../private.ts'
 * @import { _BlockResult, _Visit } from './private.ts'
 */

import { assertNotNullish } from '../../../../asserts/module.f.js'
import { toArray } from '../../../../types/list/module.f.mjs'

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
 * Only the selected loop's breaks and the owning source function's returns
 * become completion payloads. Nested loop bodies keep their own exit owner.
 * @type {(loop: Loop, target: FunctionTarget) => Block}
 */
const encodedBody = (loop, target) => walk(loop.body, false, (block, parts) => {
    let index = 0
    let changed = false
    /** @type {List<Statement>} */
    let reversed = null
    for (const statement of block.statements) {
        /** @type {Statement} */
        let mapped = statement
        if (statement[0] === 'block') {
            const part = parts[index++]
            if (part.block !== statement[2]) { changed = true; mapped = ['block', statement[1], part.block] }
        } else if (statement[0] === 'if') {
            const then = parts[index++].block
            const otherwise = parts[index++].block
            if (then !== statement[3] || otherwise !== statement[4]) { changed = true; mapped = ['if', statement[1], statement[2], then, otherwise] }
        }
        reversed = { first: mapped, tail: reversed }
    }
    const statements = toArray(reversed).toReversed()
    const exit = block.exit
    if (exit[0] === 'break' && exit[1] === loop.target) {
        return { block: { statements, exit: ['break', loop.target, [['array', ['normal', ['array', exit[2]]]]]] }, returns: false }
    }
    if (exit[0] === 'return' && exit[1] === target) {
        return { block: { statements, exit: ['break', loop.target, [['array', ['return', exit[2]]]]] }, returns: false }
    }
    return { block: changed ? { statements, exit } : block, returns: false }
}).block

/** @type {(loop: Loop, target: FunctionTarget) => readonly Statement[]} */
const completedLoop = (loop, target) => {
    const completion = /** @type {const} */ ({ index: loop.target.index })
    const wrapped = /** @type {Loop} */ ({ ...loop, results: [completion], body: encodedBody(loop, target) })
    return [
        ['loop', wrapped],
        ['if', loop.results, ['===', ['.', ['ref', completion], 0], 'return'],
            { statements: [], exit: ['return', target, ['.', ['ref', completion], 1]] },
            { statements: [], exit: ['yield', loop.results.map((_, i) => ['.', ['.', ['ref', completion], 1], i])] },
        ],
    ]
}

/**
 * Normalize statement-level returns from nonroot loops. The supplied root is
 * exempt from wrapping, while its nested loops are still visited. Returning
 * the original function when unchanged preserves the established scalar/root
 * domains and lets the caller apply terminal statement resolution only where
 * completion dispatch introduced a new early-return path.
 * @type {(fn: FastFunction, root: Loop | null) => FastFunction}
 */
export const completeReturns = (fn, root) => {
    const result = walk(fn.body, true, (block, parts) => {
        let index = 0
        let changed = false
        let returns = block.exit[0] === 'return' && block.exit[1] === fn.target
        /** @type {List<Statement>} */
        let statements = null
        for (const statement of block.statements) {
            /** @type {readonly Statement[]} */
            let added = [statement]
            if (statement[0] === 'block') {
                const part = parts[index++]
                returns = returns || part.returns
                if (part.block !== statement[2]) { changed = true; added = [['block', statement[1], part.block]] }
            } else if (statement[0] === 'if') {
                const then = parts[index++]
                const otherwise = parts[index++]
                returns = returns || then.returns || otherwise.returns
                if (then.block !== statement[3] || otherwise.block !== statement[4]) {
                    changed = true
                    added = [['if', statement[1], statement[2], then.block, otherwise.block]]
                }
            } else if (statement[0] === 'loop') {
                const part = parts[index++]
                const loop = part.block === statement[1].body ? statement[1] : { ...statement[1], body: part.block }
                returns = returns || part.returns
                if (part.returns && statement[1] !== root) {
                    changed = true
                    added = completedLoop(loop, fn.target)
                } else if (loop !== statement[1]) { changed = true; added = [['loop', loop]] }
            }
            for (const first of added) { statements = { first, tail: statements } }
        }
        return { block: changed ? { statements: toArray(statements).toReversed(), exit: block.exit } : block, returns }
    })
    return result.block === fn.body ? fn : { ...fn, body: result.block }
}
