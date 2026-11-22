/**
 * Proofs of [the number paths](./module.f.js): the type predicates, the
 * depth after a term's locals, and each way `numberPath` answers.
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { Param, Term, Type } from '../../types.ts'
 * @import { _Scope } from '../private.ts'
 */

import { assertEq, assertNotNullish, assertOk, assertStructurallySame } from '../../../asserts/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { any, l0 } from '../../l0/module.f.js'
import { add, bool, call, f64, f64c, get, let_, lit, loop, lt, match, only, sealed, trap } from '../../module.f.js'
import { depthAfter, isAny, isFloat, numberOps, numberPath } from './module.f.js'

/** A scope of the lowering at a depth, with locals of these types. @type {(depth: number, locals: readonly Param[]) => _Scope} */
const scopeOf = (depth, locals) => ({
    ir: { name: 'f', locals, functions: [], imports: l0 },
    bindings: [],
    outer: () => null,
    imported: () => null,
    depth,
    loops: [],
    inlining: [],
    building: [],
    module: () => error('no module'),
    closureOf: () => null,
})

/** Each operand as it stands, as an operand that does nothing would be. @type {(scope: _Scope, x: Term, rest: (scope: _Scope, y: Term) => Result<Term, string>) => Result<Term, string>} */
const asIs = (scope, x, rest) => rest(scope, x)

/** The IR's operator of two operands, as `native` gives it. @type {(f: (a: Term, b: Term) => Term) => (xs: readonly Term[]) => Result<Term, string>} */
const native = f => xs => ok(f(xs[0], xs[1]))

/** L1's call of the operands. @type {(ys: readonly Term[]) => Term} */
const slow = ys => call('self', 'l1.add', ys)

/** The match of an operand of `any` at local `#k`, its number at `#k+1`. @type {(y: Term, k: number, then: Term, ys: readonly Term[]) => Term} */
const matchOf = (y, k, then, ys) => match(y, [
    [['number'], `#${k}`, let_(`#${k + 1}`, call('Any', 'to_f64', [get(`#${k}`)]), then)],
    [null, null, slow(ys)],
])

export const proof = {
    isFloat: () => {
        assertEq(isFloat(f64), true)
        assertEq(isFloat(f64c), true)
        assertEq(isFloat(bool), false)
    },
    isAny: () => {
        assertEq(isAny(any), true)
        assertEq(isAny(only(any, 'number')), true)
        assertEq(isAny(sealed('Other', 'any')), false)
        assertEq(isAny(sealed('Any', 'other')), false)
        assertEq(isAny(f64), false)
    },
    numberOps: () => assertEq(numberOps.includes('add') && !numberOps.includes('concat'), true),
    // The depth after `#k` that a `let`, a loop or a match binds, at any depth; other names do not count.
    depthAfter: () => {
        assertEq(depthAfter(get('x')), 0)
        assertEq(depthAfter(let_('#4', lit(f64c, 1), get('#4'))), 5)
        assertEq(depthAfter(let_('#c0', lit(f64c, 1), let_('#', lit(f64c, 2), let_('x', lit(f64c, 3), get('x'))))), 0)
        assertEq(depthAfter(loop('L', [['#2', f64, lit(f64c, 0)], ['i', f64, lit(f64c, 0)]], trap('t'))), 3)
        assertEq(depthAfter(match(get('a'), [[['number'], '#7', get('#7')], [null, null, let_('#1', get('a'), get('#1'))]])), 8)
    },
    numberPath: {
        // A float operand is read as it is; the `any` is matched, and a float answer is boxed.
        anyAndFloat: () => assertStructurallySame(
            assertOk(assertNotNullish(numberPath(asIs, scopeOf(0, [['a', any], ['b', f64c]]), [get('a'), get('b')], [any, f64c], native(add), slow))),
            matchOf(get('a'), 0, call('Any', 'from_f64', [add(get('#1'), get('b'))]), [get('a'), get('b')]),
        ),
        // Two values of `any`, each matched once; a boolean answer is not boxed.
        bothAny: () => assertStructurallySame(
            assertOk(assertNotNullish(numberPath(asIs, scopeOf(0, [['a', any], ['b', any]]), [get('a'), get('b')], [any, any], native(lt), slow))),
            matchOf(get('a'), 0, matchOf(get('b'), 2, lt(get('#1'), get('#3')), [get('a'), get('b')]), [get('a'), get('b')]),
        ),
        // The new locals come after those an operand binds itself.
        afterOperand: () => {
            const x = let_('#4', get('a'), get('#4'))
            assertStructurallySame(
                assertOk(assertNotNullish(numberPath(asIs, scopeOf(1, [['a', any], ['b', f64c]]), [x, get('b')], [any, f64c], native(add), slow))),
                matchOf(x, 5, call('Any', 'from_f64', [add(get('#6'), get('b'))]), [x, get('b')]),
            )
        },
        // Floats alone, an `any` that holds only numbers, one that holds no number, or a boolean: L1's call alone.
        none: () => {
            /** @type {(ts: readonly Type[]) => unknown} */
            const of = ts => numberPath(asIs, scopeOf(0, [['a', ts[0]], ['b', ts[1]]]), [get('a'), get('b')], ts, native(add), slow)
            assertEq(of([f64c, f64]), null)
            assertEq(of([only(any, 'number'), f64c]), null)
            assertEq(of([only(any, 'string', 'bigint'), any]), null)
            assertEq(of([bool, any]), null)
        },
    },
}

