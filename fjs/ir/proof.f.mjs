/**
 * @import { Int } from './types.ts'
 */

import { assert, assertEq } from '../asserts/module.f.js'
import {
    abs, add, block, bool, br, call, cast, compareIn, div, eq, equal, f64, f64c, false_, fits, float, fn, get,
    i, if_, int, le, let_, lit, lt, make, match, mul, n, ne, neg, never, not, only, return_, sealed, signature,
    sqrt, sub, trap, true_, u, unit, variant,
} from './module.f.mjs'

export const proof = {
    types: () => {
        assert(equal(u(8), int(0n, 0xffn)))
        assert(equal(i(8), int(-0x80n, 0x7fn)))
        assert(equal(f64, ['f64']))
        assert(equal(f64c, ['f64c']))
        assert(equal(unit, ['product', []]))
        assert(equal(never, ['sum', []]))
        assert(equal(bool, ['sum', [['false', unit], ['true', unit]]]))
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
        assert(equal(make([['a', n(1n)]]), ['make', [['a', n(1n)]]]))
        assert(equal(variant(bool, 'true', make([])), true_))
        assert(equal(false_, ['variant', bool, 'false', ['make', []]]))
        assert(equal(match(get('b'), [[null, null, n(1n)]]), ['match', get('b'), [[null, null, n(1n)]]]))
        assert(equal(block('l', f64, n(1n)), ['block', 'l', f64, n(1n)]))
        assert(equal(br('l', n(1n)), ['br', 'l', n(1n)]))
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
    fn: () => {
        const params = /** @type {const} */ ([['a', f64], ['b', f64]])
        assert(equal(fn(params, f64, (a, b) => add(a, b)).body, add(get('a'), get('b'))))
        const f = fn(params, f64, get('a'))
        assert(equal([f.params, f.result, f.body], [params, f64, get('a')]))
        const s = signature(params, bool)
        assert(equal([s.params, s.result], [params, bool]))
    },
}
