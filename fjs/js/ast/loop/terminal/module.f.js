/**
 * Required-definition terminal loop decisions share one structural fold.
 * Transfer identities and vector widths remain exact; ordinary values and
 * invocation placement stay with their existing owners.
 *
 * @module
 * @import { Block, Definition, Loop, Value } from '../../types.ts'
 * @import { Task } from '../../task/types.ts'
 */

import { bind, call, done, run } from '../../task/module.f.js'

/**
 * Fold required-definition terminal decision trees without using the host stack.
 * Every decision has no results or reachable continuation of its own. A child
 * refusal propagates without visiting the remaining subtree.
 * @template T
 * @param {Block} block
 * @param {(block: Block) => T | null} leaf
 * @param {(prefix: readonly Definition[], test: Value, then: T, otherwise: T) => T} branch
 * @returns {Task<T | null>}
 */
export const terminalTree = (block, leaf, branch) => call(() => {
    const last = block.statements.at(-1)
    const conditional = last !== undefined && last[0] === 'if'
    const prefix = conditional ? block.statements.slice(0, -1) : block.statements
    if (!prefix.every(statement => statement[0] === 'define' && statement[3] === 'required')) { return done(null) }
    const exit = block.exit
    if (conditional) {
        if (last[1].length !== 0 || exit[0] !== 'yield' || exit[1].length !== 0) { return done(null) }
        return bind(terminalTree(last[3], leaf, branch), then => then === null ? done(null)
            : bind(terminalTree(last[4], leaf, branch), otherwise => done(otherwise === null ? null
                : branch(/** @type {readonly Definition[]} */ (prefix), last[2], then, otherwise))))
    }
    return done(leaf(block))
})

/**
 * A terminal decision can complete this loop, throw or continue its invocation.
 * Non-throw leaves supply one exact result or the complete input vector. Required
 * prefixes keep their body lifetime, so values shared by a test, transition or
 * result are established once. Empty-input continuations retain an empty vector.
 * Nonempty inputs may also continue at every leaf, with no normal completion.
 * @type {(loop: Loop) => boolean}
 */
export const isTerminalLoop = loop => {
    if (loop.results.length !== 1) { return false }
    /** @type {(block: Block) => number | null} */
    const leaf = block => {
        const exit = block.exit
        if (exit[0] === 'throw') { return 0x4 }
        if (exit[0] === 'break' && exit[1] === loop.target && exit[2].length === 1) { return 0x1 }
        return exit[0] === 'continue' && exit[1] === loop.target && exit[2].length === loop.parameters.length ? 0x2 : null
    }
    // Empty-input loops without normal completion keep their earlier source
    // plan. Every admitted tree retains at least one exact continuation.
    const kinds = run(terminalTree(loop.body, leaf, (_prefix, _test, then, otherwise) => then | otherwise))
    return kinds !== null && (kinds & 0x2) !== 0 && (loop.parameters.length !== 0 || (kinds & 0x1) !== 0)
}
