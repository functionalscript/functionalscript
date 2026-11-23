/**
 * Proofs of [the scope helpers](./module.f.js): the refusal, L1's linked
 * names, and the binding of terms that do something, in order.
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { BindingId, Value } from '../../../js/ast/types.ts'
 * @import { Param, Term } from '../../types.ts'
 * @import { _Scope } from '../private.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../../asserts/module.f.js'
import { error, ok } from '../../../types/result/module.f.js'
import { any, l0 } from '../../l0/module.f.js'
import { call, cast, constant, f64, false_, field, get, let_, lit, make, n, only, signature, true_ } from '../../module.f.js'
import {
    bindTerm, castCall, getOf, isPure, isSpread, l1Of, linking, pure, refuse, settled, settledParts, standsFor, values,
} from './module.f.js'

/** A scope of the lowering of `f`, with these locals and functions. @type {(locals: readonly Param[], functions: readonly string[]) => _Scope} */
const scopeOf = (locals, functions) => ({
    ir: { name: 'f', locals, functions: functions.map(k => [k, signature([], any)]), imports: l0 },
    bindings: [],
    outer: () => null,
    imported: () => null,
    depth: 0,
    loops: [],
    inlining: [],
    building: [],
    module: () => error('no module'),
    closureOf: () => null,
})

/** A term that does something: a builder of no items. */
const begun = call('Containers', 'begin_array', [n(0n)])

/**
 * A lowering of values that this proof spells: a number is its literal,
 * `'begun'` is {@link begun}, `'bad'` is refused, and any other string is
 * a term that does not type-check.
 *
 * @type {(scope: _Scope, v: Value) => Result<Term, string>}
 */
const lowerValue = (_, v) => typeof v === 'number' ? ok(n(BigInt(v)))
    : v === 'begun' ? ok(begun)
    : v === 'bad' ? error('bad')
    : ok(get('missing'))

const empty = scopeOf([], [])

/** What `rest` reads, as a product: the terms in order. @type {(s: _Scope, xs: readonly Term[]) => Result<Term, string>} */
const made = (_, xs) => ok(make(xs.map((x, k) => [`f${k}`, x])))

export const proof = {
    refuse: () => assertStructurallySame(refuse(empty)('no'), error('f: no')),
    // L1's names in a program, `get` of L1 itself, and none.
    linked: () => {
        const program = scopeOf([], ['l1.get', 'main'])
        assertEq(l1Of(program, 'get'), 'l1.get')
        assertEq(l1Of(program, 'add'), null)
        assert(linking(program) && !linking(empty))
        assertEq(getOf(program), 'l1.get')
        assertEq(getOf(scopeOf([], ['get'])), 'get')
        assertEq(getOf(empty), null)
    },
    standsFor: () => {
        const id = /** @type {BindingId} */ ({ index: 0 })
        assertStructurallySame(standsFor(empty, id, ['local', 'a']).bindings, [[id, ['local', 'a']]])
    },
    isPure: () => {
        for (const t of [get('a'), n(1n), constant('Any', 'undefined'), false_, true_, make([['a', n(1n)]]), field(get('a'), 'x')]) { assert(isPure(t)) }
        for (const t of [begun, make([['a', begun]]), field(begun, 'x')]) { assert(!isPure(t)) }
    },
    // A term that does something is bound to `#0`, unless the rest is only it.
    bindTerm: () => {
        assertStructurallySame(bindTerm(empty, begun, (_, name) => ok(make([['a', get(name)]]))), ok(let_('#0', begun, make([['a', get('#0')]]))))
        assertStructurallySame(bindTerm(empty, begun, (_, name) => ok(get(name))), ok(begun))
        assertStructurallySame(bindTerm(empty, begun, () => error('later')), error('later'))
        assertEq(bindTerm(empty, get('missing'), () => ok(n(0n)))[0], 'error')
    },
    values: () => {
        assertStructurallySame(values(lowerValue, empty, [1, 'begun']), ok([n(1n), begun]))
        assertStructurallySame(values(lowerValue, empty, [1, 'bad']), error('bad'))
    },
    pure: () => {
        assertStructurallySame(pure(empty, n(1n), (_, y) => ok(make([['a', y]]))), ok(make([['a', n(1n)]])))
        assertStructurallySame(pure(empty, begun, (_, y) => ok(make([['a', y]]))), ok(let_('#0', begun, make([['a', get('#0')]]))))
    },
    // Each argument in order, one that does something bound before the next.
    settled: () => {
        assertStructurallySame(settled(lowerValue, empty, [1, 'begun', 2], made), ok(let_('#0', begun, make([['f0', n(1n)], ['f1', get('#0')], ['f2', n(2n)]]))))
        assertStructurallySame(settled(lowerValue, empty, ['bad', 1], made), error('bad'))
    },
    isSpread: () => {
        assert(isSpread(['...', 1]))
        assert(!isSpread(1) && !isSpread(['ref', { index: 0 }]))
    },
    // A spread is `spread` of its value, which may refuse it.
    settledParts: () => {
        /** @type {(s: _Scope, x: Term) => Result<Term, string>} */
        const spread = (_, x) => x[0] === 'lit' && x[2] === 0n ? error('no spread') : ok(field(x, 'all'))
        /** @type {(s: _Scope, parts: readonly (readonly [boolean, Term])[]) => Result<Term, string>} */
        const parts = (_, ps) => ok(make(ps.map(([many, x], k) => [`${many ? 'many' : 'one'}${k}`, x])))
        assertStructurallySame(settledParts(lowerValue, empty, [1, ['...', 2]], spread, parts), ok(make([['one0', n(1n)], ['many1', field(n(2n), 'all')]])))
        assertStructurallySame(settledParts(lowerValue, empty, [['...', 0]], spread, parts), error('no spread'))
        assertStructurallySame(settledParts(lowerValue, empty, ['bad'], spread, parts), error('bad'))
    },
    // A local holding more kinds than a parameter takes is cast, once.
    castCall: () => {
        const wide = only(any, 'bigint', 'number')
        const scope = scopeOf([['a', wide], ['b', only(any, 'bigint')], ['c', any], ['x', f64]], [])
        /** @type {(v: Value) => Result<Term, string>} */
        const read = v => ok(get(/** @type {string} */ (v)))
        const big = only(any, 'bigint')
        assertStructurallySame(
            castCall((_, v) => read(v), scope, 'BigInt', 'add', [['p', big], ['q', big]], ['a', 'a']),
            ok(cast(big, get('a'), 'a.bigint', call('BigInt', 'add', [get('a.bigint'), get('a.bigint')]))))
        // a local of every kind
        assertStructurallySame(
            castCall((_, v) => read(v), scope, 'BigInt', 'negate', [['p', big]], ['c']),
            ok(cast(big, get('c'), 'c.bigint', call('BigInt', 'negate', [get('c.bigint')]))))
        const two = only(any, 'bigint', 'string')
        const three = only(any, 'bigint', 'number', 'string')
        const s = scopeOf([['a', three]], [])
        assertStructurallySame(
            castCall((_, v) => read(v), s, 'Any', 'same', [['p', two]], ['a']),
            ok(cast(two, get('a'), 'a.same', call('Any', 'same', [get('a.same')]))))
        // a parameter of any kind, an argument that holds only what it takes, or none of it, or no local
        assertStructurallySame(
            castCall((_, v) => v === 1 ? ok(lit(f64, 1)) : read(v), scope, 'M', 'f', [['p', any], ['q', big], ['r', only(any, 'string')], ['s', big], ['t', big]], ['a', 'b', 'a', 1, 'x']),
            ok(call('M', 'f', [get('a'), get('b'), get('a'), lit(f64, 1), get('x')])))
    },
}
