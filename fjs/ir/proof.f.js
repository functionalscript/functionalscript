/**
 * @import { Int, SealedDef, Term, Typed, TypedTerm } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.js'
import {
    abs, add, block, bool, br, call, call_ref, cast, code, codeOf, compareIn, constant, div, eq, equal, exact, f64, f64c, false_, field, fits, float, fn,
    get, hint, i, if_, inside, int, isCopy, isOwn, le, leaves, let_, lit, loop, lt, make, mayFail, match, mul, n, ne, neg, never, next, not, only, own, return_,
    definedBy, interfacesOf, release, seal, sealed, signature, sqrt, sub, terms, throw_, trap, true_, trunc_sat, u, unit, unseal, variant,
} from './module.f.js'

export const proof = {
    types: () => {
        assert(equal(u(8), int(0n, 0xffn)))
        assert(equal(i(8), int(-0x80n, 0x7fn)))
        assert(equal(f64, ['f64']))
        assert(equal(f64c, ['f64c']))
        assert(equal(unit, ['product', []]))
        assert(equal(never, ['sum', []]))
        assert(equal(bool, ['sum', [['false', unit], ['true', unit]]]))
        assert(equal(code([['borrow', f64], ['own', unit]], f64), ['code', [['borrow', f64], ['own', unit]], f64]))
    },
    // A hint is one more part of the function, beside the parts that it keeps.
    hint: () => {
        const f = fn([['x', f64]], f64, x => x)
        assertEq(hint('always', f).inline, 'always')
        assert(equal(hint('never', f).body, f.body))
    },
    equal: () => {
        assert(equal([1, [2n, 'a']], [1, [2n, 'a']]))
        assert(!equal([1, 2], [1]))
        assert(!equal([1, 2], [1, 3]))
        assert(!equal([1], 1))
        assert(equal('a', 'a'))
        // A type is recognized by its parts, never by its names.
        assert(!equal(bool, ['sum', [['true', unit], ['false', unit]]]))
    },
    fits: () => {
        // Unsigned where a range holds no negative integer.
        assert(fits(32)(u(32)))
        assert(!fits(32)(int(0n, 1n << 32n)))
        // Two's complement where it does.
        assert(fits(32)(i(32)))
        assert(!fits(32)(int(-1n, 0xffff_ffffn)))
        assert(fits(64)(int(-1n, 0x7fff_ffffn)))
    },
    compareIn: () => {
        /** @type {(a: Int, b: Int) => string} */
        const at = (a, b) => {
            const w = compareIn(a, b)
            return w === null ? 'none' : `${w.signed ? 'i' : 'u'}${w.bits}`
        }
        assertEq(at(u(32), u(32)), 'u32')
        assertEq(at(u(31), i(32)), 'i32')
        // `u(32)` and `i(32)` fit no 32-bit word together.
        assertEq(at(u(32), i(32)), 'i64')
        assertEq(at(u(64), u(8)), 'u64')
        assertEq(at(i(64), u(63)), 'i64')
        assertEq(at(u(64), i(64)), 'none')
        assertEq(at(i(32), u(64)), 'none')
    },
    terms: () => {
        assert(equal(lit(f64c, 1), ['lit', f64c, 1]))
        assert(equal(n(5n), ['lit', int(5n, 5n), 5n]))
        assert(equal(get('x'), ['get', 'x']))
        assert(equal(add(n(1n), n(2n)), ['op', 'add', [n(1n), n(2n)]]))
        assert(equal(
            [sub, mul, div, neg, abs, sqrt, eq, lt, le, float].map(o => o(get('x'))),
            ['sub', 'mul', 'div', 'neg', 'abs', 'sqrt', 'eq', 'lt', 'le', 'float'].map(k => ['op', k, [get('x')]])))
        assert(equal(call('self', 'f', [n(1n)]), ['call', 'self', 'f', [n(1n)]]))
        assert(equal(codeOf('f'), ['code', 'f']))
        assert(equal(call_ref(codeOf('f'), [n(1n)]), ['call_ref', ['code', 'f'], [n(1n)]]))
        assert(equal(make([['a', n(1n)]]), ['make', [['a', n(1n)]]]))
        assert(equal(variant(bool, 'true', make([])), true_))
        assert(equal(false_, ['variant', bool, 'false', ['make', []]]))
        assert(equal(match(get('b'), [[null, null, n(1n)]]), ['match', get('b'), [[null, null, n(1n)]]]))
        assert(equal(block('l', f64, n(1n)), ['block', 'l', f64, n(1n)]))
        assert(equal(br('l', n(1n)), ['br', 'l', n(1n)]))
        assert(equal(constant('Any', 'null'), ['constant', 'Any', 'null']))
        assert(equal([unseal(get('v')), release(get('v'))], [['op', 'unseal', [get('v')]], ['op', 'release', [get('v')]]]))
        assert(equal(seal(sealed('C', 'cell'), get('b')), ['op', 'seal', [get('b')], sealed('C', 'cell')]))
    },
    // The terms that a term holds, in their order, and the typed terms in the same places of a typed term.
    parts: () => {
        const [x, y, z] = [get('x'), get('y'), get('z')]
        /** @type {readonly (readonly [Term, readonly Term[]])[]} */
        const plain = [
            [let_('v', x, y), [x, y]],
            [add(x, y), [x, y]],
            [call('self', 'f', [x, y]), [x, y]],
            [call_ref(x, [y, z]), [x, y, z]],
            [codeOf('f'), []],
            [make([['a', x], ['b', y]]), [x, y]],
            [field(x, 'a'), [x]],
            [variant(bool, 'true', x), [x]],
            [block('l', f64, x), [x]],
            [match(x, [[null, null, y], [['true'], 'b', z]]), [x, y, z]],
            [loop('l', [['i', f64, x], ['j', f64, y]], z), [x, y, z]],
            [br('l', x), [x]],
            [n(1n), []],
            [x, []],
            [trap('no'), []],
            [constant('self', 'c'), []],
        ]
        assert(plain.every(([t, parts]) => equal(terms(t), parts)))
        /** @type {readonly [Typed, Typed, Typed]} */
        const [tx, ty, tz] = [[f64, ['get', 'x']], [f64, ['get', 'y']], [f64, ['get', 'z']]]
        /** @type {readonly (readonly [TypedTerm, readonly Typed[]])[]} */
        const typed = [
            [['let', 'v', tx, ty], [tx, ty]],
            [['op', 'add', [tx, ty]], [tx, ty]],
            [['call', 'self', 'f', [tx, ty]], [tx, ty]],
            [['call_ref', tx, [ty, tz]], [tx, ty, tz]],
            [['code', 'f'], []],
            [['make', [['a', tx], ['b', ty]]], [tx, ty]],
            [['field', tx, 'a'], [tx]],
            [['variant', bool, 'true', tx], [tx]],
            [['block', 'l', f64, tx], [tx]],
            [['match', tx, [[['false'], null, ty, null], [['true'], 'b', tz, ['true']]]], [tx, ty, tz]],
            [['loop', 'l', [['i', f64, tx], ['j', f64, ty]], tz], [tx, ty, tz]],
            [['br', 'l', tx], [tx]],
            [['get', 'x'], []],
            [['constant', 'self', 'c'], []],
        ]
        assert(typed.every(([t, parts]) => equal(inside(t), parts)))
    },
    // A term leaves to the labels of its `br`s that no region inside it binds, however deep they stand.
    leaves: () => {
        /** @type {Typed} */
        const one = [f64, ['lit', f64, 1]]
        /** @type {(label: string) => Typed} */
        const out = label => [never, ['br', label, one]]
        /** @type {readonly (readonly [Typed, readonly string[]])[]} */
        const cases = [
            [one, []],
            [out('return'), ['return']],
            [[f64, ['op', 'add', [one, out('L')]]], ['L']],
            [[f64, ['block', 'L', f64, out('L')]], []],
            [[f64, ['block', 'L', f64, [f64, ['op', 'add', [out('L'), out('M')]]]]], ['M']],
            [[f64, ['loop', 'L', [['i', f64, out('M')]], out('L')]], ['M']],
            [[f64, ['let', 'x', one, [never, ['br', 'return', out('L')]]]], ['return', 'L']],
        ]
        assert(cases.every(([t, labels]) => equal(leaves(t), labels)))
    },
    sealed: () => {
        const any = sealed('Any', 'any')
        assert(equal(any, ['sealed', 'Any', 'any', null]))
        assert(equal(only(any, 'number', 'string'), ['sealed', 'Any', 'any', ['number', 'string']]))
        assert(equal(trap('no'), ['trap', 'no']))
        // A cast is a `match` whose other arm traps, and a cast to every variant is a `let`.
        assert(equal(cast(only(any, 'number'), get('v'), 'x', x => x), match(get('v'), [[['number'], 'x', get('x')], [null, null, trap('not number')]])))
        assert(equal(cast(only(any, 'null', 'undefined'), get('v'), 'x', n(1n)), match(get('v'), [[['null', 'undefined'], 'x', n(1n)], [null, null, trap('not null or undefined')]])))
        assert(equal(cast(any, get('v'), 'x', get('x')), let_('x', get('v'), get('x'))))
        // A sealed type is copy when its interface names each of its variants as copy: a subset may be, the whole type not.
        /** @type {SealedDef} */
        const def = { variants: ['a', 'b', 'c'], carrier: 'i64', dup: 'dup', drop: 'drop', copy: ['a', 'b'] }
        assert(isCopy(def, only(any, 'b', 'a')))
        assert(!isCopy(def, only(any, 'a', 'c')))
        assert(!isCopy(def, any))
        /** @type {SealedDef} */
        const counted = { variants: ['a'], carrier: 'i64' }
        assert(!isCopy(counted, only(any, 'a')))
    },
    let_: () => {
        // The body is a term, or a function of the local.
        assert(equal(let_('x', n(1n), get('x')), ['let', 'x', n(1n), get('x')]))
        assert(equal(let_('x', n(1n), x => add(x, x)), ['let', 'x', n(1n), add(get('x'), get('x'))]))
    },
    derived: () => {
        assert(equal(if_(get('c'), n(1n), n(2n)), ['match', get('c'), [[['true'], null, n(1n)], [['false'], null, n(2n)]]]))
        assert(equal(not(get('b')), if_(get('b'), false_, true_)))
        assert(equal(ne(get('a'), get('b')), not(eq(get('a'), get('b')))))
        assert(equal(return_(n(1n)), br('return', n(1n))))
    },
    loop: () => {
        // The body is a term, or a function of the parameters' locals in their order.
        assert(equal(loop('l', [['i', f64, n(0n)]], get('i')), ['loop', 'l', [['i', f64, n(0n)]], get('i')]))
        const params = /** @type {const} */ ([['i', f64, n(0n)], ['s', f64, n(1n)]])
        assert(equal(loop('l', params, (i, s) => add(i, s)), ['loop', 'l', params, add(get('i'), get('s'))]))
        assert(equal(next('l', [['i', n(1n)]]), br('l', make([['i', n(1n)]]))))
        // `trunc_sat` is the one operator that names a range.
        assert(equal(trunc_sat(u(8), get('x')), ['op', 'trunc_sat', [get('x')], u(8)]))
    },
    exact: () => {
        /** The test of a float `y` that `exact` writes. @type {(y: Term) => Term} */
        const test = y => let_('k', trunc_sat(u(8), y), if_(eq(float(get('k')), y), get('k'), trap('inexact')))
        // A local or a literal is read where it stands, twice; any other float is bound first.
        assert(equal(exact(u(8), get('x'), 'k', k => k), test(get('x'))))
        assert(equal(exact(u(8), lit(f64c, 3), 'k', k => k), test(lit(f64c, 3))))
        assert(equal(exact(u(8), add(get('x'), get('y')), 'k', k => k), let_('k.float', add(get('x'), get('y')), test(get('k.float')))))
    },
    fn: () => {
        const params = /** @type {const} */ ([['a', f64], ['b', f64]])
        assert(equal(fn(params, f64, (a, b) => add(a, b)).body, add(get('a'), get('b'))))
        const f = fn(params, f64, get('a'))
        assert(equal([f.params, f.result, f.body], [params, f64, get('a')]))
        const s = signature(params, bool)
        assert(equal([s.params, s.result], [params, bool]))
    },
    // An interface's function that may fail says so, and a throw is a call of `Functions.throw`.
    fails: () => {
        const v = own('v', sealed('Any', 'any'))
        const s = mayFail(signature([v], never))
        assert(equal([s.params, s.result, s.fails], [[v], never, true]))
        assertEq(signature([v], never).fails, undefined)
        assert(equal(throw_(get('x')), ['call', 'Functions', 'throw', [get('x')]]))
    },
    // A parameter that the callee owns says so, and a plain one borrows.
    own: () => {
        const v = own('v', f64)
        assert(equal(v, ['v', f64, 'own']))
        assertEq(`${isOwn(v)} ${isOwn(['w', f64])}`, 'true false')
    },
    // A module that defines a type sees it as one more interface, whose functions are the module's own that its kinds name.
    defines: () => {
        const cell = sealed('T', 'cell')
        const functions = /** @type {const} */ ([['tag', signature([['v', cell]], u(1))], ['tag', signature([['v', cell]], u(2))], ['other', signature([], u(1))]])
        /** @type {SealedDef} */
        const def = { variants: ['small', 'big'], kind: 'tag', carrier: 'i64' }
        const [only, ...rest] = interfacesOf({ imports: [], defines: { name: 'T', types: [['cell', def], ['plain', { variants: ['a'], carrier: 'i32' }]] }, functions })
        assertEq(rest.length, 0)
        assertEq(`${only[0]} ${only[1].abi} ${only[1].types.map(([k]) => k).join()} ${only[1].functions.map(([k, s]) => `${k}: ${s.result[2]}`).join()}`, 'T T cell,plain tag: 1')
        assertEq(interfacesOf({ imports: [], functions }).length, 0)
        assertEq(`${definedBy({ defines: { name: 'T', types: [] } })} ${definedBy({})}`, 'T null')
    },
}
