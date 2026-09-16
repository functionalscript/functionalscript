/**
 * A JavaScript-compatible executor over the [analysis](../analysis/module.f.mjs)
 * table: `memo(analysis)(invocation)` is the program's value, every shared
 * entry evaluated once per scope and its value reused, so that `[s, s]`
 * holds one array as JavaScript's does — model §2.2 of
 * [execution-models.md](../execution-models.md), where
 * [amnesia](../amnesia/README.md) is the oracle that forgets.
 *
 * It runs the table, not the EDAG: an entry is evaluated by evaluating the
 * indices it names, through the same [operations](../operations/module.f.mjs)
 * amnesia runs, with `operand` a lookup rather than recursion. So the two
 * agree on every value that sharing does not decide, and where it does —
 * `===` over a shared constructor — amnesia's `false` is its own and this
 * executor's `true` is JavaScript's.
 *
 * **Cached per scope.** An invocation holds one slot per shared entry of its
 * scope and nothing else: the module's slots are held once per program, a
 * body's once per call, and nothing crosses the `=>` boundary, which the
 * analysis guarantees. An unshared entry is computed where it is reached,
 * since it is reached once.
 *
 * **Sharing decides how many times, never when.** A slot starts empty and
 * fills when the first edge demands the entry; nothing is evaluated for
 * being shared. A lazy operand — the right side of `&&`, `||`, `??`, an arm
 * of `?:`, a step past a failed guard — reaches its slot only when its
 * operator demands it, so `[a && s, b && s]` evaluates `s` at most once and
 * possibly never.
 *
 * @module
 *
 * @import { Analysis, Operand } from '../analysis/types.ts'
 * @import { Invocation } from './types.ts'
 */

import { operation } from '../operations/module.f.mjs'

/**
 * A cache slot: the computation the first demand runs, and its value for
 * every demand after. This is the one place the executor leans on the host
 * — a slot is filled after it is made, which no value of the language is —
 * and it is what "once per scope" means: a slot nobody demands stays empty.
 *
 * @template T
 * @param {() => T} f
 * @returns {() => T}
 */
const slot = f => {
    /** @type {readonly [] | readonly [T]} */
    let filled = []
    return () => {
        if (filled.length === 0) { filled = [f()] }
        return filled[0]
    }
}

/**
 * A new invocation of one scope: the slots of its shared entries, empty,
 * and the evaluation of an entry over them. `operand` looks an entry up —
 * its slot where it has one, computed in place where it has none — and
 * `invoke` is this again, for the body's scope, so a call starts with
 * every slot of the body empty. A primitive body is its value and opens
 * no invocation, since it names no entry and no scope holds it.
 *
 * @type {(a: Analysis, s: number) => (frame: unknown, args: readonly unknown[]) => (i: number) => unknown}
 */
const invocation = (a, s) => (frame, args) => {
    const { nodes, scope, shared } = a
    /** @type {(i: number) => unknown} */
    const compute = i => run(nodes[i])
    const slots = new Map(shared.filter(i => scope[i] === s).map(i => [i, slot(() => compute(i))]))
    /** @type {(i: number) => unknown} */
    const entry = i => {
        const cached = slots.get(i)
        return cached === undefined ? compute(i) : cached()
    }
    const run = operation({
        frame,
        args,
        operand: v => v instanceof Array ? entry(v[1]) : v,
        invoke: (frame, args, body) => body instanceof Array ? invocation(a, scope[body[1]])(frame, args)(body[1]) : body,
    })
    return entry
}

/** The program's value: its root, a primitive as it stands, an entry in the module's invocation. @type {(a: Analysis) => (i: Invocation) => unknown} */
export const memo = a => ({ frame, args }) => {
    const { root } = a
    return root instanceof Array ? invocation(a, -1)(frame, args)(root[1]) : root
}
