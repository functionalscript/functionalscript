/**
 * @import { Module, Param, Term, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import {
    add, block, bool, br, call, div, eq, f64, f64c, float, fn, get, i, if_, int, let_, lit, lt, make,
    match, mul, n, neg, never, return_, true_, u, unit, variant,
} from '../module.f.js'
import { show } from '../print/module.f.mjs'
import { corners, samples } from '../testlib.f.mjs'
import { check } from './module.f.mjs'

/** A module of one function, `f`. @type {(params: readonly Param[], result: Type, body: Term) => Module} */
const one = (params, result, body) => ({ functions: [['f', fn(params, result, body)]], exports: [] })

/** The reason that the checker gives for refusing `m`. @type {(m: Module) => string} */
const why = m => assertError(check(m))

/** The type of `f`'s body, where the checker takes it. @type {(m: Module) => string} */
const typeOf = m => show(assertOk(check(m)).functions[0][1].body[0])

const x = get('x')
const y = get('y')
const one_ = lit(f64c, 1)

export const proof = {
    samples: () => {
        const { functions, exports } = assertOk(check(samples))
        assertEq(functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '), [
            'max: f64', 'sum: int(0, 8589934590)', 'sign: int(-1, 1)', 'clamp: i(32)',
            'area: int(-1073709056, 1073741824)', 'diff: int(-10, 10)', 'double: int(0, 4294967294)',
            'delta: int(-65535, 65535)', 'product: int(0, 18446744065119617025)', 'same: bool',
            'lessU32: bool', 'lessMixed: bool', 'lessU64: bool', 'atMost: bool', 'atMostU32: bool',
            'atMostI64: bool', 'atMostU64: bool', 'notEqual: bool', 'toFloat: f64c', 'toFloatSigned: f64c',
            'toFloatWide: f64c', 'average: f64', 'magnitude: f64', 'hypot: f64', 'distance: f64',
            'safeDiv: f64', 'pow: f64', 'pick: f64', 'xor: bool',
        ].join(', '))
        assertEq(exports, samples.exports)
    },
    corners: () => {
        const { functions } = assertOk(check(corners))
        assertEq(functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '), [
            'topU32: u(32)', 'topU64: u(64)', 'bottomI64: i(64)', 'wide: u(64)', 'unitLocal: bool',
            'oneArm: f64c', 'falseFirst: f64c', 'neverBlock: never', 'neverIf: never', 'spin: never',
            'guarded: f64', 'twice: bool',
        ].join(', '))
        // `else` is written out as the variants it takes.
        const oneArm = assertOk(check(corners)).functions[5][1].body[1]
        assertEq(oneArm[0] === 'match' ? oneArm[2].map(([vs]) => vs.join(' | ')).join(', ') : '', 'false | true')
    },
    types: () => {
        // Exact: the range of a product is the range of its ends.
        assertEq(typeOf(one([['a', int(1n, 2n)], ['b', int(3n, 4n)]], u(8), mul(get('a'), get('b')))), 'int(3, 8)')
        // The arms of a `match` meet in the narrowest type that holds them, either way round.
        assertEq(typeOf(one([['b', bool]], u(8), if_(get('b'), n(2n), n(1n)))), 'int(1, 2)')
        assertEq(typeOf(one([['b', bool], ['x', f64]], f64, if_(get('b'), x, one_))), 'f64')
        assertEq(typeOf(one([['b', bool]], f64, if_(get('b'), one_, return_(one_)))), 'f64c')
    },
    functions: () => {
        assertEq(why(one([['a', int(1n, 0n)]], f64, one_)), 'f: int(1, 0) is empty')
        assertEq(why(one([], int(-1n, 0xffff_ffff_ffff_ffffn), n(1n))), 'f: int(-1, 18446744073709551615) needs more than one word')
        assertEq(why(one([['a', unit]], f64, one_)), 'f: unit is not in this slice')
        assertEq(why(one([['a', f64], ['a', f64]], f64, one_)), 'f: two parameters are named a')
        assertEq(why(one([['a', never]], f64, one_)), 'f: a is never, so no call reaches the function')
        assertEq(why(one([['x', f64]], bool, x)), 'f: the body is f64, not bool')
    },
    modules: () => {
        const f = fn([], f64, one_)
        assertEq(why({ functions: [['f', f], ['f', f]], exports: [] }), 'two functions are named f')
        assertEq(why({ functions: [['f', f]], exports: ['g'] }), 'no function g to export')
        assertEq(why({ functions: [['f', f]], exports: ['f', 'f'] }), 'f is exported twice')
    },
    lit: () => {
        assertEq(why(one([], f64, lit(unit, 1n))), 'f: unit is not in this slice')
        assertEq(why(one([], u(8), lit(u(8), 1))), 'f: 1 is not a literal of u(8)')
        assertEq(why(one([], u(8), lit(u(8), 0x100n))), 'f: 256 is not a literal of u(8)')
        assertEq(why(one([], u(8), lit(u(8), -1n))), 'f: -1 is not a literal of u(8)')
        assertEq(why(one([], f64, lit(f64, 1n))), 'f: 1 is not a literal of f64')
        assertEq(why(one([], bool, lit(bool, 1n))), 'f: 1 is not a literal of bool')
    },
    get: () => assertEq(why(one([], f64, x)), 'f: no local x'),
    let_: () => {
        assertEq(why(one([['x', f64]], f64, let_('x', one_, one_))), 'f: x is bound twice')
        assertEq(why(one([], f64, let_('x', y, one_))), 'f: no local y')
        assertEq(why(one([], f64, let_('x', one_, y))), 'f: no local y')
        assertEq(why(one([], f64, let_('x', return_(one_), one_))), 'f: a br that gives no value stands where a value is used')
    },
    op: () => {
        const ints = /** @type {const} */ ([['a', u(64)], ['b', i(64)]])
        assertEq(why(one([], f64, add(y, one_))), 'f: no local y')
        assertEq(why(one([], f64, neg(one_, one_))), 'f: neg takes one operand, not 2')
        assertEq(why(one([], f64, add(one_))), 'f: add takes 2 operands, not 1')
        assertEq(why(one(ints, f64, float(get('a')))), 'f: float of u(64): a float holds the integers within ±2^53 only')
        assertEq(why(one([], f64, neg(n(1n)))), 'f: neg of an integer is not in this slice')
        assertEq(why(one(ints, f64, add(get('a'), get('a')))), 'f: add of u(64) and u(64) is int(0, 36893488147419103230), which needs more than one word')
        assertEq(why(one(ints, bool, lt(get('a'), get('b')))), 'f: lt of u(64) and i(64) needs more than one word')
        assertEq(why(one([], f64, div(n(1n), n(2n)))), 'f: div of two integers is not in this slice')
        assertEq(why(one([], f64, float(one_))), 'f: float of f64c: float takes an integer')
        assertEq(why(one([], f64, add(n(1n), one_))), 'f: add of int(1, 1) and f64c: the operands are integers or floats, not both')
        assertEq(why(one([], f64, eq(true_, true_))), 'f: eq of bool and bool: the operands are integers or floats, not both')
    },
    call: () => {
        /** @type {(body: Term) => Module} */
        const g = body => ({ functions: [['f', fn([['a', bool]], f64, body)]], exports: [] })
        assertEq(why(g(call('m', 'g', []))), 'f: m.g: a call of another module is not in this slice')
        assertEq(why(g(call('self', 'g', []))), 'f: no function g')
        assertEq(why(g(call('self', 'f', []))), 'f: f takes one argument, not 0')
        assertEq(why(one([['a', f64], ['b', f64]], f64, call('self', 'f', [one_]))), 'f: f takes 2 arguments, not 1')
        assertEq(why(g(call('self', 'f', [y]))), 'f: no local y')
        assertEq(why(g(call('self', 'f', [one_]))), "f: f's a is bool, not f64c")
    },
    make: () => assertEq(why(one([], f64, make([['a', n(1n)]]))), 'f: a product with fields is not in this slice'),
    variant: () => {
        assertEq(why(one([], bool, variant(['sum', [['a', unit]]], 'a', make([])))), 'f: a variant of sum({ a: unit }): the one sum of this slice is bool')
        assertEq(why(one([], bool, variant(bool, 'maybe', make([])))), 'f: bool has no variant maybe')
        assertEq(why(one([], bool, variant(bool, 'true', y))), 'f: no local y')
        assertEq(why(one([], bool, variant(bool, 'true', n(1n)))), 'f: true holds unit, not int(1, 1)')
    },
    match: () => {
        const b = /** @type {const} */ ([['b', bool]])
        /** @type {(arms: Parameters<typeof match>[1]) => string} */
        const arms = xs => why(one(b, f64, match(get('b'), xs)))
        assertEq(why(one([], f64, if_(y, one_, one_))), 'f: no local y')
        assertEq(why(one([], f64, if_(one_, one_, one_))), 'f: a match of f64c is not in this slice')
        assertEq(arms([[['maybe'], null, one_], [null, null, one_]]), 'f: no variant maybe')
        assertEq(arms([[['true'], null, one_], [['true'], null, one_], [['false'], null, one_]]), 'f: true has two arms')
        assertEq(arms([[[], null, one_], [null, null, one_]]), 'f: an arm names no variant')
        assertEq(arms([[['true'], 'x', one_], [['false'], null, one_]]), 'f: a name for the operand of an arm is not in this slice')
        assertEq(arms([[null, null, one_], [['true'], null, one_]]), 'f: else is not the last arm')
        assertEq(arms([[['true'], null, one_], [['false'], null, one_], [null, null, one_]]), 'f: else takes no variant')
        assertEq(arms([[['true'], null, one_]]), 'f: no arm for false')
        assertEq(arms([]), 'f: no arm for false or true')
        assertEq(why(one(b, f64, if_(get('b'), y, one_))), 'f: no local y')
        assertEq(why(one(b, f64, if_(get('b'), one_, true_))), 'f: match: its arms are f64c, bool, which no one type holds')
        assertEq(why(one(b, u(64), if_(get('b'), n(-1n), lit(u(64), 1n)))), 'f: match: int(-1, 18446744073709551615) needs more than one word')
    },
    block: () => {
        assertEq(why(one([], f64, block('l', f64, block('l', f64, one_)))), 'f: the label l is in scope already')
        assertEq(why(one([], f64, block('return', f64, one_))), 'f: the label return is in scope already')
        assertEq(why(one([], f64, block('l', unit, make([])))), 'f: unit is not in this slice')
        assertEq(why(one([], f64, block('l', f64, y))), 'f: no local y')
        assertEq(why(one([], f64, block('l', bool, one_))), 'f: block l is bool, and its body is f64c')
    },
    br: () => {
        assertEq(why(one([], f64, br('l', one_))), 'f: no label l')
        assertEq(why(one([], f64, return_(y))), 'f: no local y')
        assertEq(why(one([], f64, return_(true_))), 'f: return takes f64, not bool')
        assertEq(why(one([], f64, add(return_(one_), one_))), 'f: a br that gives no value stands where a value is used')
    },
}
