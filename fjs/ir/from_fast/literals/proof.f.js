/**
 * Proofs of [the boxed-literals pass](./module.f.js): which terms box a
 * number, each shape of term walked, and the constants that a module gets.
 *
 * @import { Module, Term } from '../../types.ts'
 */

import { assertEq, assertNotNullish, assertStructurallySame } from '../../../asserts/module.f.js'
import { any } from '../../l0/module.f.js'
import { block, br, call, call_ref, constant, f64, f64c, field, get, int, let_, lit, loop, make, match, n, only, trap, u, variant } from '../../module.f.js'
import { boxed, literals, nameOf, replace } from './module.f.js'

/** `Any.from_f64` of the float literal `v`. @type {(v: number) => Term} */
const box = v => call('Any', 'from_f64', [lit(f64c, v)])

/** The `k`th constant. @type {(k: number) => Term} */
const c = k => constant('self', nameOf(k))

/** The type of a boxed number. */
const number = only(any, 'number')

/** @type {Module} */
const module = {
    imports: [],
    constants: [['#c0', { type: any, value: box(5) }]],
    functions: [
        ['f', { params: [], result: any, body: let_('x', box(1), call('self', 'g', [get('x'), box(1), box(-0), box(0), box(NaN), box(NaN)])) }],
        ['g', { params: [], result: any, body: box(0) }],
    ],
    exports: ['f'],
}

export const proof = {
    boxed: () => {
        assertEq(boxed(box(1.5)), 1.5)
        assertEq(boxed(call('Any', 'from_f64', [lit(f64, 2)])), 2)
        assertEq(boxed(call('Any', 'from_f64', [get('x')])), null)
        assertEq(boxed(call('Any', 'from_bool', [lit(f64c, 1)])), null)
        assertEq(boxed(call('Other', 'from_f64', [lit(f64c, 1)])), null)
        assertEq(boxed(call('Any', 'from_f64', [])), null)
        assertEq(boxed(call('Any', 'from_f64', [n(1n)])), null)
        assertEq(boxed(get('x')), null)
    },
    // Each shape of term is walked, in its order, so the numbers are named by where they are first boxed.
    replace: () => {
        /** @type {(t: Term) => readonly [Term, readonly number[]]} */
        const of = t => replace([], t)
        assertStructurallySame(of(let_('a', box(1), box(2))), [let_('a', c(0), c(1)), [1, 2]])
        assertStructurallySame(of(['op', 'add', [box(1), box(1)]]), [['op', 'add', [c(0), c(0)]], [1]])
        assertStructurallySame(of(['op', 'trunc_sat', [box(1)], u(8)]), [['op', 'trunc_sat', [c(0)], u(8)], [1]])
        assertStructurallySame(of(call_ref(get('f'), [box(3)])), [call_ref(get('f'), [c(0)]), [3]])
        assertStructurallySame(of(make([['a', box(1)], ['b', box(2)]])), [make([['a', c(0)], ['b', c(1)]]), [1, 2]])
        assertStructurallySame(of(field(make([['a', box(1)]]), 'a')), [field(make([['a', c(0)]]), 'a'), [1]])
        assertStructurallySame(of(variant(any, 'v', box(1))), [variant(any, 'v', c(0)), [1]])
        assertStructurallySame(of(block('b', any, br('b', box(1)))), [block('b', any, br('b', c(0))), [1]])
        assertStructurallySame(of(match(box(1), [[['number'], 'x', box(2)], [null, null, trap('no')]])), [match(c(0), [[['number'], 'x', c(1)], [null, null, trap('no')]]), [1, 2]])
        assertStructurallySame(of(loop('l', [['i', any, box(1)]], br('l', make([['i', box(2)]])))), [loop('l', [['i', any, c(0)]], br('l', make([['i', c(1)]]))), [1, 2]])
        assertStructurallySame(of(lit(int(0n, 0n), 0n)), [lit(int(0n, 0n), 0n), []])
        // A number already named is read from its constant.
        assertStructurallySame(replace([7], box(7)), [c(0), [7]])
    },
    // The functions' numbers are constants before the module's own, `0` and `-0` two, and each `NaN` one.
    literals: () => {
        const m = literals(module)
        assertStructurallySame(m.constants, [
            [nameOf(0), { type: number, value: box(1) }],
            [nameOf(1), { type: number, value: box(-0) }],
            [nameOf(2), { type: number, value: box(0) }],
            [nameOf(3), { type: number, value: box(NaN) }],
            ['#c0', { type: any, value: box(5) }],
        ])
        assertStructurallySame(m.functions, [
            ['f', { params: [], result: any, body: let_('x', c(0), call('self', 'g', [get('x'), c(0), c(1), c(2), c(3), c(3)])) }],
            ['g', { params: [], result: any, body: c(2) }],
        ])
        assertEq(Object.is(boxed(assertNotNullish(m.constants)[1][1].value), -0), true)
        // A module that boxes no number is as it was.
        /** @type {Module} */
        const plain = { ...module, functions: [['g', { params: [], result: any, body: get('x') }]] }
        assertEq(literals(plain), plain)
        // A module with no constants of its own gets the numbers alone.
        assertStructurallySame(literals({ imports: [], functions: [['g', { params: [], result: any, body: box(4) }]], exports: [] }).constants, [[nameOf(0), { type: number, value: box(4) }]])
    },
}
