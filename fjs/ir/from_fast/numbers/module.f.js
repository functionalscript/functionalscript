/**
 * The number paths of [the lowering](../module.f.js): a numeric operator
 * of L1 whose operands may hold numbers tests them once and answers with
 * the operator of the IR where they are numbers
 * ([benchmark.md](../../../../doc/sasha-gil/ir/benchmark.md#levers)).
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Param, Term, Type } from '../../types.ts'
 * @import { _Scope } from '../private.ts'
 */

import { assertNotNullish } from '../../../asserts/module.f.js'
import { ok, unwrap } from '../../../types/result/module.f.js'
import { typeOf } from '../../check/module.f.js'
import { any, kinds } from '../../l0/module.f.js'
import { call, f64, f64c, get, let_, match, only, terms } from '../../module.f.js'

/** @typedef {(scope: _Scope, x: Term, rest: (scope: _Scope, y: Term) => Result<Term, string>) => Result<Term, string>} _Pure */

/** Whether a type is a float. @type {(t: Type) => boolean} */
export const isFloat = t => t[0] === 'f64' || t[0] === 'f64c'

/** Whether a type is `any`, of every kind or of some. @type {(t: Type) => boolean} */
export const isAny = t => t[0] === 'sealed' && t[1] === any[1] && t[2] === any[2]

/**
 * The depth after every local `#k` that a term binds: a term lowered at
 * a depth binds `#k` from it on, so a local bound around the term takes a
 * depth after them, or it would be one of them.
 *
 * @type {(t: Term) => number}
 */
const depthAfter = t => {
    const own = t[0] === 'let' ? [t[1]]
        : t[0] === 'loop' ? t[2].map(([k]) => k)
        : t[0] === 'match' ? t[2].flatMap(([, binder]) => binder === null ? [] : [binder])
        : []
    const here = own.flatMap(k => k.startsWith('#') && k.length > 1 && [...k.slice(1)].every(c => c >= '0' && c <= '9') ? [Number(k.slice(1)) + 1] : [])
    return [...here, ...terms(t).map(depthAfter)].reduce((a, b) => a < b ? b : a, 0)
}

/** L1's numeric operators, which the IR's operators answer where every operand is a number. @type {readonly string[]} */
export const numberOps = ['add', 'subtract', 'multiply', 'divide', 'negate', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual']

/**
 * A numeric operator of L1 with a path for numbers before its call
 * ([benchmark.md, lever "test only the side that is not known"](../../../../doc/sasha-gil/ir/benchmark.md#levers)):
 * where each operand is a float or a value of `any` that may hold a number,
 * and one is such an `any`, each `any` is matched once against `number`,
 * read once with `to_f64`, and the operator of the IR, `native`, answers
 * where all are numbers, boxed where it is a float. Else `slow`, L1's call
 * of the operands, each float boxed only there. A number is its own
 * primitive and its own numeric value, so L1 would answer the same. Each
 * operand is bound first, in its order, as it is read twice. `null` where
 * an operand may hold no number, for L1's call alone.
 *
 * `pure` binds a term that does something to a local, in the lowering's scope.
 *
 * @type {(pure: _Pure, scope: _Scope, xs: readonly Term[], ts: readonly Type[], native: (xs: readonly Term[], ts: readonly Type[]) => Result<Term, string> | null, slow: (ys: readonly Term[]) => Term) => Result<Term, string> | null}
 */
export const numberPath = (pure, scope, xs, ts, native, slow) => {
    /** Whether an operand is matched against `number`: `false` for a float, `null` where it holds no number, or nothing else. @type {(t: Type) => boolean | null} */
    const tested = t => {
        if (isFloat(t)) { return false }
        const held = t[0] === 'sealed' ? t[3] ?? kinds : []
        return isAny(t) && held.includes('number') && held.length > 1 ? true : null
    }
    const tests = ts.map(tested)
    if (tests.includes(null) || !tests.includes(true)) { return null }
    /** A scope with one more local of a type, and the local's name. @type {(s: _Scope, t: Type) => readonly [_Scope, string]} */
    const local = (s, t) => {
        const name = `#${s.depth}`
        return [{ ...s, ir: { ...s.ir, locals: [...s.ir.locals, /** @type {Param} */ ([name, t])] }, depth: s.depth + 1 }, name]
    }
    /** The match of each `any` from the `j`th on, its number bound, and the operator of the IR of them all. @type {(s: _Scope, ys: readonly Term[], j: number, numbers: readonly Term[]) => Term} */
    const matched = (s, ys, j, numbers) => {
        if (j === ys.length) {
            // the operands are numbers, which the operator of the IR takes
            const r = unwrap(assertNotNullish(native(numbers, numbers.map(() => f64))))
            return isFloat(unwrap(typeOf(s.ir)(r))) ? call('Any', 'from_f64', [r]) : r
        }
        const y = ys[Number(j)]
        if (!tests[Number(j)]) { return matched(s, ys, j + 1, [...numbers, y]) }
        const [s1, binder] = local(s, only(any, 'number'))
        const [s2, n] = local(s1, f64c)
        return match(y, [[['number'], binder, let_(n, call('Any', 'to_f64', [get(binder)]), matched(s2, ys, j + 1, [...numbers, get(n)]))], [null, null, slow(ys)]])
    }
    /** The operands from the `j`th on bound, in their order, then matched. @type {(s: _Scope, j: number, ys: readonly Term[]) => Result<Term, string>} */
    const bound = (s, j, ys) => j === xs.length ? ok(matched(s, ys, 0, []))
        : pure(s, xs[Number(j)], (inner, y) => bound(inner, j + 1, [...ys, y]))
    // the operands were lowered at this depth, so what they bind is after it
    const depth = [scope.depth, ...xs.map(depthAfter)].reduce((a, b) => a < b ? b : a)
    return bound({ ...scope, depth }, 0, [])
}
