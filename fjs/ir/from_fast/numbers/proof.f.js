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
import { any, l0, string } from '../../l0/module.f.js'
import { native as rows } from '../../native/module.f.js'
import { add, bool, call, constant, f64, f64c, false_, get, let_, lit, loop, lt, match, n, only, sealed, sub, trap, true_, u } from '../../module.f.js'
import {
    asAny, boolean, depthAfter, floats, inOrder, isAny, isFloat, nativeRow, numberOps, numberPath, numberRow, numeric, primitive,
} from './module.f.js'

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
    // A value of `any` is itself, a float or a boolean is boxed, and an integer is not.
    asAny: () => {
        assertStructurallySame(asAny(any, get('v')), get('v'))
        assertStructurallySame(asAny(f64c, get('x')), call('Any', 'from_f64', [get('x')]))
        assertStructurallySame(asAny(bool, get('b')), call('Any', 'from_bool', [get('b')]))
        assertEq(asAny(u(8), get('i')), null)
    },
    // Each kind of primitive, and those that need the runtime, refused without it.
    primitive: () => {
        assertStructurallySame(assertOk(primitive([], 1.5)), lit(f64c, 1.5))
        assertStructurallySame(assertOk(primitive([], 3n)), n(3n))
        assertStructurallySame(assertOk(primitive([], true)), true_)
        assertStructurallySame(assertOk(primitive([], false)), false_)
        assertStructurallySame(assertOk(primitive(l0, 'x')), lit(string, 'x'))
        assertStructurallySame(assertOk(primitive(l0, null)), constant('Any', 'null'))
        assertStructurallySame(assertOk(primitive(l0, undefined)), constant('Any', 'undefined'))
        assertEq(primitive([], 'x')[0], 'error')
        assertEq(primitive([], null)[1], 'null is a constant of Any, which a module lowered without the runtime does not import')
    },
    // Which operands an operator of the IR takes.
    operands: () => {
        assertEq(numeric([f64, f64c]), true)
        assertEq(numeric([u(8), u(8)]), true)
        assertEq(numeric([u(8), f64]), false)
        assertEq(boolean([bool, bool]), true)
        assertEq(boolean([bool, f64]), false)
        assertEq(floats([f64, f64c]), true)
        assertEq(floats([u(8)]), false)
        assertStructurallySame(assertOk(nativeRow('numberAnd')([get('a'), get('b')])), call('Native', 'numberAnd', [get('a'), get('b')]))
        assertStructurallySame(assertOk(inOrder(sub)([get('a'), get('b')])), sub(get('a'), get('b')))
    },
    // A native row of two floats, refused for other operands, without the rows, or where an operand has no type.
    numberRow: () => {
        const scope = scopeOf(0, [['a', f64], ['b', f64c], ['i', u(8)]])
        const native = { ir: { ...scope.ir, imports: [...l0, /** @type {const} */ (['Native', rows])] } }
        const row = numberRow('%', 'numberRemainder')
        assertStructurallySame(assertOk(row(native, [get('a'), get('b')])), call('Native', 'numberRemainder', [get('a'), get('b')]))
        assertEq(row(native, [get('a'), get('i')])[1], 'f: % of f64 and u(8) is not in this slice')
        assertEq(row(scope, [get('a'), get('b')])[1], "f: % of two floats calls L1's native rows, which a module lowered without the runtime does not import")
        assertEq(row(native, [get('missing'), get('b')])[0], 'error')
    },
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

