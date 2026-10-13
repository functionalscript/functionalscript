/**
 * A loop recognized in the analysis table, so that every writer spells it
 * as one rather than as the recursion it is written as. V8 and Rust
 * implement no tail calls, so a function iterating by a call to itself
 * overflows the stack on every target but a VM with them.
 *
 * One template, the loop over one state value whose condition continues
 * it:
 *
 * ```js
 * ['=>', 1, FRAME, ['?:', COND, ['()', ['self'], [NEXT]], ['arg', 0]]]
 * ```
 *
 * which is `r => COND ? self(NEXT) : r`, the recursive spelling of
 * `while (COND) { r = NEXT; }`. `COND` and `NEXT` are any nodes, and
 * `self` is read nowhere but as that one callee. A comma is admitted
 * around the call and at the root, each for the asserts its operands
 * before the last are: a `const` the next value does not reach lowers to
 * one. Every node on the path — the commas, the `?:` and the call — is
 * reached by one edge, since a writer spells the path as statements, and
 * a shared node is written once, as an expression, where no statement can
 * stand.
 *
 * `fjs/edag/todo/tail-call-loop.md` has the design and the consumers.
 *
 * @module
 *
 * @import { Analysis, ItemOperand, Node, Operand } from '../analysis/types.ts'
 * @import { Loop } from './types.ts'
 */

import { operandsOf } from '../analysis/module.f.mjs'

/**
 * The node an operand names where it is reached by one edge, and `null`
 * for a primitive or a shared entry.
 *
 * @type {(a: Analysis, v: Operand) => Node | null}
 */
const unshared = (a, v) => v instanceof Array && !a.shared.includes(v[1]) ? a.nodes[v[1]] : null

/**
 * An operand as a comma's operands: the asserts before its last and the
 * last, for an unshared comma holding at least one operand, and no assert
 * and the operand itself for anything else.
 *
 * @type {(a: Analysis, v: Operand) => { readonly before: readonly Operand[], readonly last: Operand }}
 */
const comma = (a, v) => {
    const node = unshared(a, v)
    return node !== null && node[0] === ',' && node[1].length !== 0
        ? { before: node[1].slice(0, -1), last: node[1][node[1].length - 1] }
        : { before: [], last: v }
}

/** Whether an operand names a node of the tag, `['arg', 0]` where the index is given. @type {(a: Analysis, v: Operand, tag: string, index?: number) => boolean} */
const names = (a, v, tag, index) => {
    if (!(v instanceof Array)) { return false }
    const node = a.nodes[v[1]]
    return node[0] === tag && (index === undefined || node[1] === index)
}

/**
 * The operands a node establishes in its own scope: its own, but a nested
 * function's body, which is that function's scope and not this one's.
 *
 * @type {(node: Node) => readonly Operand[]}
 */
const own = node => node[0] === '=>' ? node[2] : operandsOf(node)

/**
 * How many edges the nodes of function `i`'s scope hold into its `self`:
 * the reads of the function itself, as a callee, a value, or a nested
 * function's capture.
 *
 * @type {(a: Analysis, i: number) => number}
 */
const selfReads = (a, i) => {
    const { nodes, scope } = a
    /** @type {(v: Operand) => boolean} */
    const isSelf = v => v instanceof Array && nodes[v[1]][0] === 'self' && scope[v[1]] === i
    return nodes.flatMap((node, j) => scope[j] === i ? own(node).filter(isSelf) : []).length
}

/**
 * The parts of function `i` where it is the template, and `null` where it
 * is not: another length, a body that is not the `?:` — a comma around it
 * aside — a condition arm that is not the self-call with one plain
 * argument, a comma around it aside, an alternate that is not the
 * parameter, a shared node on the path, or `self` read anywhere else.
 *
 * @type {(a: Analysis, i: number) => Loop | null}
 */
export const loopOf = (a, i) => {
    const fn = a.nodes[i]
    if (fn[0] !== '=>' || fn[1] !== 1) { return null }
    const root = comma(a, fn[3])
    const tail = unshared(a, root.last)
    if (tail === null || tail[0] !== '?:') { return null }
    const [, condition, then, otherwise] = tail
    const step = comma(a, then)
    const call = unshared(a, step.last)
    if (call === null || call[0] !== '()' || !names(a, call[1], 'self') || !names(a, otherwise, 'arg', 0)) { return null }
    const [, , args] = call
    if (args.length !== 1 || selfReads(a, i) !== 1) { return null }
    const [next] = /** @type {readonly [ItemOperand]} */ (args)
    if (next instanceof Array && next[0] === '...') { return null }
    return { before: root.before, condition, arm: then, asserts: step.before, next }
}
