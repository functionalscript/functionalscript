/**
 * Index resolved source writes once, before immutable value normalization.
 * Held functions contribute no evaluation effects; their bodies are indexed
 * independently, while direct calls include their analyzed source writes.
 *
 * @module
 * @import { BindingId, FunctionTarget, Operator } from '../../types.ts'
 * @import { SourceBlock, SourceValue } from '../source.ts'
 * @import { List } from '../../../../types/list/types.ts'
 * @import { Task } from '../../task/types.ts'
 */

import { operatorOperands } from '../../module.f.mjs'
import { bind, call, done, run } from '../../task/module.f.mjs'
import { toArray } from '../../../../types/list/module.f.mjs'
import { assertNotNullish } from '../../../../asserts/module.f.js'

/**
 * @param {SourceValue | SourceBlock} root
 * @param {ReadonlyMap<FunctionTarget, readonly BindingId[]>} functions
 * @returns {ReadonlyMap<SourceValue | SourceBlock, readonly BindingId[]>}
 */
export const writes = (root, functions) => {
    /**
     * @typedef {SourceValue | SourceBlock} Node
     * @typedef {List<readonly [Node, readonly BindingId[]]>} Entries
     * @typedef {{ readonly writes: readonly BindingId[], readonly entries: Entries }} Result
     * @type {(node: Node, entries: Entries) => Task<Result>}
     */
    const visit = (node, entries) => call(() => {
        if (node === null || typeof node !== 'object') { return done({ writes: [], entries }) }
        /** @type {readonly Node[]} */
        let children = []
        /** @type {readonly BindingId[]} */
        let own = []
        let opaque = false
        if (node instanceof Array) {
            if (node[0] === 'function') { children = [...node[1].parameters.flatMap(parameter => parameter.default === null ? [] : [parameter.default.value]), node[1].body]; opaque = true }
            else if (node[0] === 'block') { children = [node[1]] }
            else if (node[0] !== 'ref') {
                children = operatorOperands(/** @type {Operator<SourceValue>} */ (node))
                if (node[0] === '()' && node[1] instanceof Array && node[1][0] === 'function') { own = assertNotNullish(functions.get(node[1][1].target), 'missing source function write facts') }
            }
        } else {
            const block = /** @type {SourceBlock} */ (node)
            for (const statement of block.statements) {
                if (statement[0] === 'write') { own = [...own, statement[1]] }
                children = [...children, ...(statement[0] === 'initialize' || statement[0] === 'write' ? [statement[2]]
                    : statement[0] === 'if' ? [statement[1], statement[2], statement[3]]
                    : statement[0] === 'while' ? [statement[1].condition, statement[1].body]
                    : statement[0] === 'switch' ? [statement[1].discriminant, ...statement[1].cases.flatMap(arm => [...arm.labels, arm.body]), statement[1].otherwise]
                    : statement[0] === 'return' ? [statement[2]] : statement[0] === 'throw' ? [statement[1]] : [])]
            }
            const exit = block.exit
            children = [...children, ...(exit[0] === 'if' ? [exit[1], exit[2], exit[3]]
                : exit[0] === 'switch' ? [exit[1], ...exit[2].flatMap(arm => [...arm.labels, arm.body]), exit[3]]
                    : [exit[0] === 'return' ? exit[2] : exit[1]])]
        }
        /** @type {(index: number, entries: Entries, found: List<readonly BindingId[]>) => Task<Result>} */
        const each = (index, entries, found) => call(() => {
            if (index !== children.length) { return bind(visit(children[index], entries), result => each(index + 1, result.entries, { first: result.writes, tail: found })) }
            const all = opaque ? [] : [...new Set([...own, ...toArray(found).flat()])]
            return done({ writes: all, entries: { first: [node, all], tail: entries } })
        })
        return each(0, entries, null)
    })
    return new Map(toArray(run(visit(root, null)).entries))
}
