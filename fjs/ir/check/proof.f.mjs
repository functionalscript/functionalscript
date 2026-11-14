/**
 * @import { Interface, Module, Param, Term, Type } from '../types.ts'
 */

import { assertEq, assertError, assertOk } from '../../asserts/module.f.js'
import { any, l0 } from '../l0/module.f.js'
import {
    add, block, bool, br, call, cast, div, eq, f64, f64c, field, float, fn, get, i, if_, int, let_, lit, loop, lt, make,
    match, mul, n, neg, never, next, only, product, return_, sealed, signature, sub, trap, true_, trunc_sat, u, unit,
    variant,
} from '../module.f.js'
import { show } from '../print/module.f.js'
import { corners, loops, records, samples, unknown } from '../testlib.f.mjs'
import { check, typeOf } from './module.f.js'

/** A module of one function, `f`. @type {(params: readonly Param[], result: Type, body: Term) => Module} */
const one = (params, result, body) => ({ imports: [], functions: [['f', fn(params, result, body)]], exports: [] })

/** A module of one function, `f`, that imports L0 and more. @type {(params: readonly Param[], result: Type, body: Term, more?: readonly (readonly [string, Interface])[]) => Module} */
const overL0 = (params, result, body, more = []) => ({ imports: [...l0, ...more], functions: [['f', fn(params, result, body)]], exports: [] })

/** A module that imports one interface beside L0, and has no function. @type {(i: Interface) => Module} */
const importing = i => ({ imports: [...l0, ['Bad', i]], functions: [], exports: [] })

/** The kinds of the type of a body over L0, where the checker takes it. @type {(params: readonly Param[], body: Term) => string} */
const kindsOf = (params, body) => show(assertOk(typeOf({ name: 'f', locals: params, result: f64, functions: [], imports: l0 })(body)))

/** The reason that the checker gives for refusing `m`. @type {(m: Module) => string} */
const why = m => assertError(check(m))

/** The type of `f`'s body, where the checker takes it. @type {(m: Module) => string} */
const bodyType = m => show(assertOk(check(m)).functions[0][1].body[0])

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
        assertEq(bodyType(one([['a', int(1n, 2n)], ['b', int(3n, 4n)]], u(8), mul(get('a'), get('b')))), 'int(3, 8)')
        // The arms of a `match` meet in the narrowest type that holds them, either way round.
        assertEq(bodyType(one([['b', bool]], u(8), if_(get('b'), n(2n), n(1n)))), 'int(1, 2)')
        assertEq(bodyType(one([['b', bool], ['x', f64]], f64, if_(get('b'), x, one_))), 'f64')
        assertEq(bodyType(one([['b', bool]], f64, if_(get('b'), one_, return_(one_)))), 'f64c')
    },
    functions: () => {
        assertEq(why(one([['a', int(1n, 0n)]], f64, one_)), 'f: int(1, 0) is empty')
        assertEq(why(one([], int(-1n, 0xffff_ffff_ffff_ffffn), n(1n))), 'f: int(-1, 18446744073709551615) needs more than one word')
        assertEq(why(one([['a', unit]], f64, one_)), 'f: unit is not in this slice')
        // A product stays in its function.
        assertEq(why(one([['r', product([['a', f64]])]], f64, one_)), 'f: { a: f64 } is not in this slice')
        assertEq(why(one([], product([['a', f64]]), make([['a', one_]]))), 'f: { a: f64 } is not in this slice')
        assertEq(why(one([['a', f64], ['a', f64]], f64, one_)), 'f: two parameters are named a')
        assertEq(why(one([['a', never]], f64, one_)), 'f: a is never, so no call reaches the function')
        assertEq(why(one([['x', f64]], bool, x)), 'f: the body is f64, not bool')
    },
    modules: () => {
        const f = fn([], f64, one_)
        assertEq(why({ imports: [], functions: [['f', f], ['f', f]], exports: [] }), 'two functions are named f')
        assertEq(why({ imports: [], functions: [['f', f]], exports: ['g'] }), 'no function g to export')
        assertEq(why({ imports: [], functions: [['f', f]], exports: ['f', 'f'] }), 'f is exported twice')
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
        assertEq(why(one([], f64, eq(true_, true_))), 'f: eq of bool and bool: an operator takes integers or floats')
    },
    call: () => {
        /** @type {(body: Term) => Module} */
        const g = body => ({ imports: [], functions: [['f', fn([['a', bool]], f64, body)]], exports: [] })
        assertEq(why(g(call('m', 'g', []))), 'f: no interface m')
        assertEq(why(g(call('self', 'g', []))), 'f: no function g')
        assertEq(why(g(call('self', 'f', []))), 'f: f takes one argument, not 0')
        assertEq(why(one([['a', f64], ['b', f64]], f64, call('self', 'f', [one_]))), 'f: f takes 2 arguments, not 1')
        assertEq(why(g(call('self', 'f', [y]))), 'f: no local y')
        assertEq(why(g(call('self', 'f', [one_]))), "f: f's a is bool, not f64c")
    },
    products: () => {
        const p = /** @type {const} */ ([['x', f64], ['b', bool]])
        const b = get('b')
        const r = make([['a', x], ['b', b]])
        /** The type of a term where `x` and `b` stand. @type {(t: Term) => string} */
        const typeAt = t => show(assertOk(typeOf({ name: 'f', locals: p, result: f64, functions: [], imports: [] })(t)))
        /** The reason that the checker gives for refusing `f` of `x` and `b`, whose body is `t`. @type {(t: Term) => string} */
        const refused = t => why(one(p, f64, t))
        // A product is its fields, in their order, and `field` reads one.
        assertEq(typeAt(r), '{ a: f64, b: bool }')
        assertEq(typeAt(make([])), 'unit')
        assertEq(typeAt(make([['p', r], ['u', make([])], ['c', one_]])), '{ p: { a: f64, b: bool }, u: unit, c: f64c }')
        assertEq(typeAt(field(field(make([['p', r]]), 'p'), 'b')), 'bool')
        assertEq(typeAt(let_('r', r, field(get('r'), 'a'))), 'f64')
        // A product passes where a product of the same fields, each as wide, goes, and two meet field by field.
        assertEq(typeAt(block('l', product([['a', f64], ['u', unit]]), make([['a', one_], ['u', make([])]]))), '{ a: f64, u: unit }')
        assertEq(typeAt(if_(b, make([['a', n(1n)]]), make([['a', n(2n)]]))), '{ a: int(1, 2) }')
        assertEq(typeAt(if_(b, make([['a', one_]]), make([['a', x]]))), '{ a: f64 }')
        assertEq(typeAt(loop('l', [['r', product([['k', f64]]), make([['k', one_]])]], s =>
            if_(lt(field(s, 'k'), x), next('l', [['r', make([['k', add(field(s, 'k'), one_)]])]]), s))), '{ k: f64 }')
        // What a product may not be.
        assertEq(refused(make([['a', one_], ['a', one_]])), 'f: a product names a twice')
        assertEq(refused(make([['a', y]])), 'f: no local y')
        assertEq(refused(make([['a', trap('no')]])), 'f: a trap that gives no value stands where a value is used')
        assertEq(refused(field(one_, 'a')), 'f: field a of f64c, which is no product')
        assertEq(refused(field(r, 'c')), 'f: { a: f64, b: bool } has no field c')
        assertEq(refused(field(y, 'a')), 'f: no local y')
        assertEq(refused(field(return_(one_), 'a')), 'f: a br that gives no value stands where a value is used')
        assertEq(refused(block('l', product([['a', never]]), trap('no'))), 'f: { a: never } holds no value, since its field a is never')
        assertEq(refused(block('l', product([['a', f64], ['a', f64]]), trap('no'))), 'f: { a: f64, a: f64 } has two fields named a')
        assertEq(refused(block('l', product([['s', ['sum', [['x', unit]]]]]), trap('no'))), 'f: sum({ x: unit }) is not in this slice')
        assertEq(refused(block('l', product([['a', f64], ['b', bool]]), make([['b', true_], ['a', one_]]))),
            'f: block l is { a: f64, b: bool }, and its body is { b: bool, a: f64c }')
        assertEq(refused(block('l', product([['a', f64c]]), make([['a', x]]))), 'f: block l is { a: f64c }, and its body is { a: f64 }')
        assertEq(refused(if_(b, make([['a', one_]]), make([['a', true_]]))), 'f: match: its arms are { a: f64c }, { a: bool }, which no one type holds')
        assertEq(refused(if_(b, make([['a', one_]]), make([['c', one_]]))), 'f: match: its arms are { a: f64c }, { c: f64c }, which no one type holds')
        assertEq(refused(if_(b, make([['a', n(-1n)]]), make([['a', lit(u(64), 1n)]]))), 'f: match: int(-1, 18446744073709551615) needs more than one word')
        assertEq(refused(match(r, [[null, null, one_]])), 'f: a match of { a: f64, b: bool } is not in this slice')
        assertEq(refused(add(r, r)), 'f: add of { a: f64, b: bool } and { a: f64, b: bool }: an operator takes integers or floats')
        assertEq(refused(call('self', 'f', [r, b])), "f: f's x is f64, not { a: f64, b: bool }")
        assertEq(refused(loop('l', [['r', product([['k', never]]), trap('no')]], one_)), 'f: { k: never } holds no value, since its field k is never')
    },
    records: () => {
        const { functions } = assertOk(check(records))
        assertEq(functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '), [
            'stringIndex: f64', 'midpoint: f64', 'fib: f64', 'choose: u(64)', 'middle: f64', 'widened: u(64)', 'nested: f64',
            'steps: f64', 'describe: f64c', 'kindOfFirst: int(0, 8)',
        ].join(', '))
    },
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
        assertEq(arms([[['true'], 'x', one_], [['false'], null, one_]]), "f: a name for the operand of a bool's arm is not in this slice")
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
        assertEq(why(one([], f64, block('l', unit, make([])))), 'f: the body is unit, not f64')
        assertEq(why(one([], f64, block('l', f64, y))), 'f: no local y')
        assertEq(why(one([], f64, block('l', bool, one_))), 'f: block l is bool, and its body is f64c')
    },
    typeOf: () => {
        // The type of a term where it stands, as a producer asks for it while it builds a body.
        const scope = { name: 'f', locals: /** @type {const} */ ([['a', u(8)], ['x', f64]]), result: f64, functions: /** @type {const} */ ([['g', signature([['b', bool]], u(16))]]), imports: [] }
        assertEq(show(assertOk(typeOf(scope)(add(get('a'), n(1n))))), 'int(1, 256)')
        assertEq(show(assertOk(typeOf(scope)(call('self', 'g', [true_])))), 'u(16)')
        assertEq(show(assertOk(typeOf(scope)(return_(x)))), 'never')
        assertEq(assertError(typeOf(scope)(return_(true_))), 'f: return takes f64, not bool')
        assertEq(assertError(typeOf(scope)(get('y'))), 'f: no local y')
    },
    trap: () => {
        assertEq(bodyType(one([], f64, trap('no'))), 'never')
        assertEq(why(one([], f64, add(trap('no'), one_))), 'f: a trap that gives no value stands where a value is used')
    },
    unknown: () => {
        const { imports, functions } = assertOk(check(unknown))
        assertEq(imports, unknown.imports)
        assertEq(functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '),
            'toBoolean: bool, kindOf: int(0, 8), isNumber: bool, size: u(31), tag: int(0, 8), number: f64c, fail: never, falsy: bool')
        // `else` is written out as the kinds it takes.
        const [, , arms] = /** @type {readonly ['match', unknown, readonly (readonly [readonly string[], unknown, unknown])[]]} */ (functions[0][1].body[1])
        assertEq(arms.map(([vs]) => vs.join(' | ')).join(', '), 'boolean, number, string, bigint, array | object | function, undefined | null')
    },
    sealed: () => {
        const v = get('v')
        const p = /** @type {const} */ ([['v', any]])
        const kind = call('Any', 'kind', [v])
        // An arm's name is the operand at the kinds of the arm, and they meet where the arms do.
        assertEq(kindsOf(p, match(v, [[['number'], 'x', get('x')], [['string', 'bigint'], 's', get('s')], [null, null, trap('no')]])), 'any.only(number, string, bigint)')
        assertEq(kindsOf(p, match(v, [[['number'], 'x', get('x')], [null, 'r', get('r')]])), 'any')
        assertEq(kindsOf(p, match(v, [[['null', 'number'], 'x', match(get('x'), [[['number'], 'y', get('y')], [null, null, trap('null')]])], [null, null, trap('no')]])), 'any.only(number)')
        // A narrower value passes where a wider one goes.
        assertEq(kindsOf(p, cast(only(any, 'number'), v, 'x', x => call('Any', 'kind', [x]))), 'int(0, 8)')
        assertEq(kindsOf(p, let_('w', v, w => call('Any', 'kind', [w]))), 'int(0, 8)')
        assertEq(bodyType(overL0(p, f64, cast(only(any, 'number'), v, 'x', x => call('Any', 'to_f64', [x])))), 'f64c')
        // What a module may not write.
        assertEq(why(one(p, f64, one_)), 'f: no interface Any')
        assertEq(why(overL0([['v', sealed('Any', 'nope')]], f64, one_)), 'f: Any has no type nope')
        assertEq(why(overL0([['v', only(any)]], f64, one_)), 'f: any.only() holds no value')
        assertEq(why(overL0([['v', only(any, 'symbol')]], f64, one_)), 'f: any has no variant symbol')
        assertEq(why(overL0([['v', only(any, 'null', 'null')]], f64, one_)), 'f: any.only(null, null) names null twice')
        assertEq(why(overL0(p, any, v)), 'f: the result is any, which the caller would own: not in this slice')
        assertEq(why(overL0(p, f64, lit(any, 1n))), 'f: a literal of any is a constant, which is not in this slice')
        assertEq(why(overL0(p, f64, add(v, v))), 'f: add of any and any: an operator takes integers or floats')
        // A call of an interface takes its arguments at the kinds of its parameters.
        assertEq(why(overL0(p, f64, call('Any', 'to_f64', [v]))), "f: Any.to_f64's v is any.only(number), not any")
        assertEq(why(overL0(p, f64, call('Any', 'nope', [v]))), 'f: Any has no function nope')
        assertEq(why(overL0(p, f64, call('Any', 'kind', []))), 'f: Any.kind takes one argument, not 0')
        assertEq(why(overL0(p, f64, call('Make', 'any', []), [['Make', { abi: 'test', types: [], functions: [['any', signature([], any)]] }]])),
            'f: Make.any gives any, which its caller would own: not in this slice')
        // A `match` of `any` names its kinds, and an arm's name is a local like any other.
        assertEq(why(overL0(p, f64, match(v, [[['symbol'], null, one_], [null, null, one_]]))), 'f: no variant symbol')
        assertEq(why(overL0(p, f64, cast(only(any, 'number'), v, 'x', x => match(x, [[['string'], null, one_], [null, null, one_]])))), 'f: no variant string')
        assertEq(why(overL0(p, f64, match(v, [[['number'], 'v', one_], [null, null, one_]]))), 'f: v is bound twice')
        assertEq(why(overL0(p, f64, match(v, [[['number'], 'x', get('x')], [null, null, one_]]))), 'f: match: its arms are any.only(number), f64c, which no one type holds')
        assertEq(why(overL0(p, f64, if_(eq(kind, n(3n)), v, one_))), 'f: match: its arms are any, f64c, which no one type holds')
        // Sealed types of two interfaces never meet.
        const other = /** @type {Interface} */ ({ abi: 'test', types: [['x', { variants: ['a'], kind: 'k', carrier: 'i32' }]], functions: [['k', signature([['x', sealed('Other', 'x')]], int(0n, 0n))]] })
        assertEq(why(overL0([...p, ['o', sealed('Other', 'x')]], f64, match(v, [[['number'], 'x', get('x')], [null, null, get('o')]]), [['Other', other]])),
            'f: match: its arms are any.only(number), x, which no one type holds')
        assertEq(why(overL0([['o', sealed('Other', 'x')]], f64, call('Any', 'kind', [get('o')]), [['Other', other]])), "f: Any.kind's v is any, not x")
    },
    interfaces: () => {
        const t = sealed('Bad', 't')
        assertEq(why({ imports: [...l0, l0[0]], functions: [], exports: [] }), 'Any is imported twice')
        assertEq(why({ imports: [['self', l0[0][1]]], functions: [], exports: [] }), 'self is the module itself, so no interface has that name')
        assertEq(why(importing({ abi: 'test', types: [['t', { variants: ['a', 'a'], kind: 'k', carrier: 'i32' }]], functions: [] })), 'Bad: t names a variant twice')
        // A call and a sealed type find a function and a type by its name, so the interface names each once.
        assertEq(why(importing({ abi: 'test', types: [], functions: [['f', signature([['x', f64]], f64)], ['f', signature([['x', bool]], f64)]] })), 'Bad: two functions are named f')
        const s = /** @type {const} */ (['s', { variants: ['a'], kind: 'k', carrier: 'i32' }])
        assertEq(why(importing({ abi: 'test', types: [s, ['s', { ...s[1], carrier: 'i64' }]], functions: [] })), 'Bad: two types are named s')
        assertEq(why(importing({ abi: 'test', types: [], functions: [['f', signature([['x', unit]], f64)]] })), 'Bad: unit is not in this slice')
        /** An interface of `t`, of two variants, and a function `k`. @type {(params: readonly Param[], result: Type) => Interface} */
        const tagged = (params, result) => ({ abi: 'test', types: [['t', { variants: ['a', 'b'], kind: 'k', carrier: 'i32' }]], functions: [['k', signature(params, result)]] })
        const untagged = 'Bad: k does not answer the tag of t, one for each of its variants'
        assertEq(why(importing({ ...tagged([], u(1)), functions: [] })), untagged)
        assertEq(why(importing(tagged([['x', f64]], u(1)))), untagged)
        assertEq(why(importing(tagged([['x', t]], int(0n, 2n)))), untagged)
        assertEq(assertOk(check(importing(tagged([['x', t]], u(1))))).imports.length, 6)
        // The scope of a term passes the same rules: a local may be a product, and a function's result may not.
        const scope = { name: 'f', locals: /** @type {const} */ ([['a', product([['s', ['sum', [['x', unit]]]]])]]), result: f64, functions: [], imports: [] }
        assertEq(assertError(typeOf(scope)(one_)), 'f: sum({ x: unit }) is not in this slice')
        assertEq(show(assertOk(typeOf({ ...scope, locals: [['a', unit]] })(get('a')))), 'unit')
        assertEq(assertError(typeOf({ ...scope, locals: [], result: unit })(one_)), 'f: unit is not in this slice')
        assertEq(assertError(typeOf({ ...scope, locals: [], functions: [['g', signature([['b', unit]], f64)]] })(one_)), 'g: unit is not in this slice')
    },
    loops: () => {
        const { functions } = assertOk(check(loops))
        assertEq(functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '), [
            'stringEquals: bool', 'stringLess: bool', 'factorial: f64', 'triangle: f64', 'kindAfter: int(0, 8)',
            'index: u(31)', 'indexOfSum: u(31)', 'three: u(31)', 'toU31: u(31)', 'toI32: i(32)', 'toU32: u(32)',
            'toSmall: int(-5, 300)', 'toU64: u(64)', 'toI64: i(64)', 'toWide: int(10, 1099511627776)',
            'toNegative: int(-1099511627776, -3)',
        ].join(', '))
    },
    loop: () => {
        const p = /** @type {const} */ ([['x', f64]])
        /** A loop of `f`, which gives an `f64`. @type {(params: Parameters<typeof loop>[1], body: Parameters<typeof loop>[2]) => Module} */
        const looping = (params, body) => one(p, f64, loop('l', params, body))
        // The loop's type is its body's, and a parameter takes a narrower first value.
        assertEq(bodyType(looping([['k', f64, one_]], k => if_(lt(k, x), next('l', [['k', add(k, one_)]]), k))), 'f64')
        assertEq(bodyType(looping([], one_)), 'f64c')
        // A label and a parameter are new names, of types that a module may write and that hold a value.
        assertEq(why(one(p, f64, block('l', f64, looping([], one_).functions[0][1].body))), 'f: the label l is in scope already')
        assertEq(why(looping([], loop('l', [], one_))), 'f: the label l is in scope already')
        assertEq(why(looping([['k', f64, one_], ['k', f64, one_]], one_)), 'f: loop l has two parameters named k')
        assertEq(why(looping([['x', f64, one_]], one_)), 'f: x is bound twice')
        assertEq(why(looping([['k', ['sum', [['x', unit]]], make([])]], one_)), 'f: sum({ x: unit }) is not in this slice')
        assertEq(why(looping([['k', never, trap('no')]], one_)), 'f: k is never, so loop l never starts')
        // The first values are typed where the loop stands, and the body where the parameters are.
        assertEq(why(looping([['k', f64, y]], one_)), 'f: no local y')
        assertEq(why(looping([['k', f64, true_]], one_)), 'f: k of loop l is f64, not bool')
        assertEq(why(looping([['k', f64, get('k')]], one_)), 'f: no local k')
        assertEq(why(looping([], y)), 'f: no local y')
        assertEq(why(looping([], make([]))), 'f: the body is unit, not f64')
        assertEq(why(one(p, f64, let_('r', loop('l', [['k', f64, one_]], k => k), get('k')))), 'f: no local k')
        assertEq(why(one(p, f64, let_('r', loop('l', [], one_), next('l', [])))), 'f: no label l')
        // A `br` to a loop gives each of its parameters, by name, in their order.
        const two = /** @type {const} */ ([['a', f64, one_], ['b', f64, one_]])
        assertEq(why(looping(two, br('l', one_))), "f: br l takes { a, b }, the loop's parameters in their order")
        assertEq(why(looping(two, next('l', [['b', one_], ['a', one_]]))), "f: br l takes { a, b }, the loop's parameters in their order")
        assertEq(why(looping(two, next('l', [['a', one_]]))), "f: br l takes { a, b }, the loop's parameters in their order")
        assertEq(why(looping(two, next('l', [['a', one_], ['b', y]]))), 'f: no local y')
        assertEq(why(looping(two, next('l', [['a', one_], ['b', true_]]))), 'f: b of loop l is f64, not bool')
        assertEq(why(looping(two, add(next('l', [['a', one_], ['b', one_]]), one_))), 'f: a br that gives no value stands where a value is used')
    },
    trunc_sat: () => {
        const p = /** @type {const} */ ([['x', f64]])
        assertEq(bodyType(one(p, u(8), trunc_sat(u(8), x))), 'u(8)')
        assertEq(bodyType(one(p, u(8), trunc_sat(u(8), one_))), 'u(8)')
        assertEq(why(one(p, u(8), ['op', 'trunc_sat', [x]])), 'f: trunc_sat takes the range that it saturates to')
        assertEq(why(one(p, u(8), trunc_sat(int(0n, 1n << 64n), x))), 'f: int(0, 18446744073709551616) needs more than one word')
        assertEq(why(one(p, u(8), ['op', 'trunc_sat', [x, x], u(8)])), 'f: trunc_sat takes one operand, not 2')
        assertEq(why(one(p, u(8), trunc_sat(u(8), n(1n)))), 'f: trunc_sat of int(1, 1): trunc_sat takes a float')
        assertEq(why(one(p, u(8), trunc_sat(u(8), y))), 'f: no local y')
        assertEq(why(one(p, f64, ['op', 'add', [x, x], u(8)])), 'f: add takes no range')
    },
    br: () => {
        assertEq(why(one([], f64, br('l', one_))), 'f: no label l')
        assertEq(why(one([], f64, return_(y))), 'f: no local y')
        assertEq(why(one([], f64, return_(true_))), 'f: return takes f64, not bool')
        assertEq(why(one([], f64, add(return_(one_), one_))), 'f: a br that gives no value stands where a value is used')
    },
}
