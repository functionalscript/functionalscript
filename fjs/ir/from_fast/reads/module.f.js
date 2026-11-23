/**
 * Reads of `any` that a program answers in place before L1's `get`, lever
 * P4 of the perf demos: `x.length` of a value of `any` that may be an
 * array or a string reads Containers' or String's `length` where it is
 * one, and calls `get` only for the other kinds. L1's `get` would answer
 * the same, a number, but only after it compares its key with `"length"`
 * unit by unit.
 *
 * @module
 *
 * @import { Term, Type } from '../../types.ts'
 */

import { kinds } from '../../l0/module.f.js'
import { call, float, get, match } from '../../module.f.js'
import { isAny } from '../numbers/module.f.js'

/** The kinds whose `length` a module of L0 reads, each with that module. @type {readonly (readonly [string, string])[]} */
const lengths = [['array', 'Containers'], ['string', 'String']]

/**
 * `x.length` of `x`, a term of type `t`: a `match` with an arm for each kind
 * of {@link lengths} that `x` may hold, boxed as a number, and one for the
 * rest, which `slow` reads of the rest, each arm naming `x` after `base`.
 * `null` where `x` is no `any` or holds neither kind, for `slow` alone.
 *
 * @type {(x: Term, t: Type, slow: (rest: Term) => Term, base: string) => Term | null}
 */
export const lengthRead = (x, t, slow, base) => {
    if (!isAny(t) || t[0] !== 'sealed') { return null }
    const held = t[3] ?? kinds
    const fast = lengths.filter(([k]) => held.includes(k))
    if (fast.length === 0) { return null }
    const rest = held.filter(k => !fast.some(([f]) => f === k))
    const other = `${base}.other`
    return match(x, [
        ...fast.map(([k, module]) => {
            const b = `${base}.${k}`
            return /** @type {const} */ ([[k], b, call('Any', 'from_f64', [float(call(module, 'length', [get(b)]))])])
        }),
        ...(rest.length === 0 ? [] : [/** @type {const} */ ([null, other, slow(get(other))])]),
    ])
}
