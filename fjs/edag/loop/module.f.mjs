/**
 * Established scalar-loop recognition for common EDAG-to-FAST conversion.
 * Writers consume prepared FAST; they do not query this analysis themselves.
 * General evaluation-aware tail recovery lives in `fjs/edag/to_fast`.
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
 * Common conversion uses this recognizer to retain established scalar graph
 * and output compatibility. {@link keepsRecursion} excludes shapes from this
 * scalar shortcut; general tail recovery can still handle them with complete
 * invocation and placement analysis.
 *
 * `fjs/edag/to_fast/README.md` owns tail-call eligibility and consumers.
 *
 * @module
 *
 * @import { Analysis, ItemOperand, Node, Operand } from '../analysis/types.ts'
 * @import { Loop } from './types.ts'
 */

import { mergeable, ownOperandsOf, scopeHolds } from '../analysis/module.f.mjs'

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
    return nodes.flatMap((node, j) => scope[j] === i ? ownOperandsOf(node).filter(isSelf) : []).length
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

/**
 * The entries an operand reaches in its own scope — a nested function's
 * body is that function's own, its slots this scope's — each walked once,
 * so a heavily shared graph costs its entries and not its paths.
 *
 * @type {(a: Analysis) => (v: Operand) => readonly number[]}
 */
const reached = a => v => {
    /** @type {(seen: readonly number[], v: Operand) => readonly number[]} */
    const go = (seen, v) => !(v instanceof Array) || seen.includes(v[1]) ? seen : ownOperandsOf(a.nodes[v[1]]).reduce(go, [...seen, v[1]])
    return go([], v)
}

/**
 * Whether an operand reaches an entry among `shared` in its own scope, as
 * {@link reached} walks it.
 *
 * @type {(a: Analysis, shared: readonly number[]) => (v: Operand) => boolean}
 */
export const reaches = (a, shared) => v => reached(a)(v).some(i => shared.includes(i))

/**
 * Whether the established scalar shortcut keeps recursion for function `i`,
 * a loop by {@link loopOf}, rather than applying that shortcut
 * (`fjs/edag/to_fast/README.md`): an assert before the condition,
 * which runs every round where a `const` before the loop would run once;
 * a read of the rest array, which each round of the recursion sees empty
 * from the second on, where a loop would keep the first call's; and a
 * value the condition shares with the block that mints identity — a
 * container, a function, a call (`mergeable` in `fjs/edag/analysis`),
 * an entry of the function's own scope both reach — which the recursion
 * establishes once a round, where a loop tests the condition before the
 * block and would establish it twice, two values where the graph has
 * one. A value that merges, a read the condition and the block
 * repeat, `r[0]`, is one value however many times it is evaluated, and
 * loops. These exclusions belong to this compatibility recognizer; shared
 * general recovery and source-profile admission have their own contracts.
 *
 * What both reach is asked of the graph, not of the table's count of
 * sharing, so a table that merges twins and one that keeps every node its
 * own (`identityAnalysis`) give one answer: two reaches of one value that
 * mints meet at a node reached from both, whatever counts it as shared.
 *
 * @type {(a: Analysis, i: number, loop: Loop) => boolean}
 */
export const keepsRecursion = (a, i, { before, condition, arm }) => {
    const fromCondition = reached(a)(condition)
    const fromArm = reached(a)(arm)
    return before.length !== 0 || scopeHolds(a, i, 'rest')
        || a.nodes.some((n, j) => a.scope[j] === i && !mergeable(n) && fromCondition.includes(j) && fromArm.includes(j))
}
