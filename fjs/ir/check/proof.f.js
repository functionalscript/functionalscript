/**
 * @import { Interface, Module, Param, Signature, Term, Type } from '../types.ts'
 */

import { assert, assertEq, assertError, assertNotNullish, assertOk } from '../../asserts/module.f.js'
import { any, builder, l0, memory, ref, string } from '../l0/module.f.js'
import {
    add, and, block, bool, br, call, call_ref, canon, cast, code, codeOf, constant, countsBits, definedBy, div, eq, f64, f64c, field, float, fn, from_bits, get, hint, i, if_, int,
    le, let_, lit, loop, lt, make, match, mayFail, misuse, mul, n, ne, neg, never, next, not, only, or, own, product, release, return_, seal, sealed, shl, shr, signature, sub,
    throw_, to_bits, trap, true_, trunc_sat, u, unit, unseal, variant, xor,
} from '../module.f.js'
import { show } from '../print/module.f.js'
import { bits, constants, corners, counting, loops, records, referencing, samples, sealing, tagging, throws, unknown } from '../testlib.f.js'
import { module as anyModule } from '../runtime/any/module.f.js'
import { check, checkPlain, typeOf } from './module.f.js'

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

/** A constant of the module. @type {(name: string) => Term} */
const self = name => constant('self', name)

/** A module over L0 of constants and functions, which exports none. @type {(cs: NonNullable<Module['constants']>, fs?: Module['functions']) => Module} */
const withConstants = (cs, fs = []) => ({ imports: l0, constants: cs, functions: fs, exports: [] })

/** An interface beside L0 whose only part is its constants. @type {(cs: NonNullable<Interface['constants']>) => Module} */
const constantsOf = cs => importing({ abi: 'test:bad', types: [], constants: cs, functions: [] })

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
    constants: () => {
        // Each constant is typed as the term that `init` evaluates, which may be narrower than its type.
        assertEq(assertOk(check(constants)).constants.map(([k, c]) => `${k}: ${show(c.value[0])}`).join(', '), [
            'half: f64', 'quarter: f64', 'eighth: f64', 'answer: int(42, 42)', 'far: int(-1099511627776, -1099511627776)',
            'less: bool', 'six: f64', 'a: any.only(string)', 'aa: any.only(string)', 'nothing: any.only(null)',
        ].join(', '))
        // A constant is one of the module's own, `self`, or of an interface that the module imports.
        assertEq(why(withConstants([['k', { type: f64, value: self('j') }]])), 'k: no constant j')
        assertEq(why(withConstants([['k', { type: f64, value: constant('Any', 'nope') }]])), 'k: Any has no constant nope')
        assertEq(why(withConstants([['k', { type: f64, value: constant('String', 'empty') }]])), 'k: String has no constant empty')
        assertEq(why(withConstants([['k', { type: f64, value: constant('Nope', 'c') }]])), 'k: no interface Nope')
        // The term gives a value of the constant's type, with no local and no label in scope.
        assertEq(why(withConstants([['k', { type: bool, value: one_ }]])), 'k: the value is f64c, not bool')
        assertEq(why(withConstants([['k', { type: f64, value: trap('no') }]])), 'k: a trap that gives no value stands where a value is used')
        assertEq(why(withConstants([['k', { type: f64, value: x }]])), 'k: no local x')
        assertEq(why(withConstants([['k', { type: f64, value: return_(one_) }]])), 'k: no label return')
        // A constant is one value, which one global holds, and its name is its own.
        assertEq(why(withConstants([['k', { type: never, value: trap('no') }]])), 'k: a constant of never holds no value')
        assertEq(why(withConstants([['k', { type: product([['a', f64]]), value: make([['a', one_]]) }]])), 'k: { a: f64 } is not in this slice')
        assertEq(why(withConstants([['k', { type: f64, value: one_ }], ['k', { type: f64, value: one_ }]])), 'two constants are named k')
        assertEq(why(withConstants([], [['init', fn([], f64, one_)]])), 'init is the function that evaluates the constants, so no function has that name')
        // The loader makes the table of code, and the module exports none, so a function may be exported as `table`.
        assertOk(check({ imports: [], functions: [['table', fn([], f64, one_)]], exports: ['table'] }))
        // `init` evaluates the constants in their order, so each reads only those before it, itself or through the functions that it calls.
        assertEq(why(withConstants([['j', { type: f64, value: self('k') }], ['k', { type: f64, value: one_ }]])), 'j: k is read before init evaluates it')
        assertEq(why(withConstants([['k', { type: f64, value: self('k') }]])), 'k: k is read before init evaluates it')
        assertEq(why(withConstants([['j', { type: f64, value: call('self', 'g', []) }], ['k', { type: f64, value: one_ }]], [['g', fn([], f64, self('k'))]])),
            'j: k is read before init evaluates it')
        assertEq(why(withConstants(
            [['j', { type: f64, value: call('self', 'g', []) }], ['k', { type: f64, value: one_ }]],
            [['g', fn([], f64, call('self', 'h', []))], ['h', fn([], f64, self('k'))]])),
            'j: k is read before init evaluates it')
        assertOk(check(withConstants([['j', { type: f64, value: one_ }], ['k', { type: f64, value: call('self', 'g', []) }]], [['g', fn([], f64, self('j'))]])))
        // `code(f)` only takes a table index; it does not run `f`, so a constant of `code(f)` may precede one that `f` reads.
        assertOk(check(withConstants(
            [['c', { type: code([], f64), value: codeOf('g') }], ['k', { type: f64, value: one_ }]],
            [['g', fn([], f64, self('k'))]],
        )))
        // A `call_ref` of a known `code(g)` runs `g`, so it may not precede a constant that `g` reads.
        assertEq(why(withConstants(
            [['j', { type: f64, value: call_ref(codeOf('g'), []) }], ['k', { type: f64, value: one_ }]],
            [['g', fn([], f64, self('k'))]],
        )), 'j: k is read before init evaluates it')
        // An unresolved code value may run any function; the same order is refused.
        assertEq(why(withConstants(
            [['c', { type: code([], f64), value: codeOf('g') }], ['j', { type: f64, value: call_ref(self('c'), []) }], ['k', { type: f64, value: one_ }]],
            [['g', fn([], f64, self('k'))]],
        )), 'j: k is read before init evaluates it')
        assertOk(check(withConstants(
            [['c', { type: code([], f64), value: codeOf('g') }], ['k', { type: f64, value: one_ }], ['j', { type: f64, value: call_ref(self('c'), []) }]],
            [['g', fn([], f64, self('k'))]],
        )))
        // An unresolved `call_ref` inside a called helper is the same: readings take every function.
        assertEq(why(withConstants(
            [
                ['c', { type: code([], f64), value: codeOf('g') }],
                ['j', { type: f64, value: call('self', 'apply', [self('c')]) }],
                ['k', { type: f64, value: one_ }],
            ],
            [
                ['g', fn([], f64, self('k'))],
                ['apply', fn([['c', code([], f64)]], f64, c => call_ref(c, []))],
            ],
        )), 'j: k is read before init evaluates it')
        assertOk(check(withConstants(
            [
                ['c', { type: code([], f64), value: codeOf('g') }],
                ['k', { type: f64, value: one_ }],
                ['j', { type: f64, value: call('self', 'apply', [self('c')]) }],
            ],
            [
                ['g', fn([], f64, self('k'))],
                ['apply', fn([['c', code([], f64)]], f64, c => call_ref(c, []))],
            ],
        )))
        // An interface names each of its constants once, each of a type that a global holds.
        assertEq(why(constantsOf([['c', f64], ['c', f64]])), 'Bad: two constants are named c')
        assertEq(why(constantsOf([['c', product([['a', f64]])]])), 'Bad: c: { a: f64 } is not in this slice')
        assertEq(why(constantsOf([['c', never]])), 'Bad: c: a constant of never holds no value')
        // A host gives one value for each name of an ABI, so a constant and a function, or two constants whose globals hold
        // different WASM values, may not share one. Two constants whose globals hold one value share the host's global.
        assertEq(why(importing({ abi: 'test:bad', types: [], constants: [['c', f64]], functions: [['c', signature([], f64)]] })), 'the constant Bad.c and the function Bad.c are both the import c of test:bad')
        assertEq(why(importing({ abi: 'fjs:l0', types: [], constants: [['kind', f64]], functions: [] })), 'the constant Bad.kind and the function Any.kind are both the import kind of fjs:l0')
        assertEq(why(importing({ abi: 'fjs:l0', types: [], constants: [['null', f64]], functions: [] })), 'the constants Any.null, a global of i64, and Bad.null, a global of f64, are both the import null of fjs:l0')
        assertOk(check(importing({ abi: 'fjs:l0', types: [], constants: [['null', only(any, 'null')]], functions: [] })))
        assertOk(check(importing({ abi: 'fjs:l0', types: [], constants: [['null', any]], functions: [] })))
        /** A module that imports `c` of one ABI from two interfaces, as `a` and as `b`. @type {(a: Type, b: Type) => Module} */
        const twice = (a, b) => ({
            imports: [['A', { abi: 'test:c', types: [], constants: [['c', a]], functions: [] }], ['B', { abi: 'test:c', types: [], constants: [['c', b]], functions: [] }]],
            functions: [],
            exports: [],
        })
        assertOk(check(twice(f64c, f64)))
        assertOk(check(twice(int(0n, 1n), bool)))
        assertEq(why(twice(int(0n, 1n), u(64))), 'the constants A.c, a global of i32, and B.c, a global of i64, are both the import c of test:c')
        // A sealed type that no interface defines is the interface's refusal.
        assertEq(why(twice(sealed('Nope', 'x'), f64)), "A: c: no interface Nope")
        // typeOf reads the constants that a scope names, and a constant's term, which has no result, has no label.
        assertEq(show(assertOk(typeOf({ name: 'f', locals: [], functions: [], imports: l0, constants: [['k', f64]] })(self('k')))), 'f64')
        assertEq(show(assertOk(typeOf({ name: 'f', locals: [], result: f64, functions: [], imports: l0 })(constant('Any', 'null')))), 'any.only(null)')
        assertEq(assertError(typeOf({ name: 'k', locals: [], functions: [], imports: l0, constants: [] })(return_(one_))), 'k: no label return')
        assertEq(assertError(typeOf({ name: 'f', locals: [], functions: [], imports: l0, constants: [['k', product([['a', f64]])]] })(one_)), 'f: { a: f64 } is not in this slice')
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
    code: () => {
        const bin = code([['borrow', f64], ['borrow', f64]], f64)
        /** @type {Module} */
        const m = {
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['apply', fn([['c', bin], ['a', f64], ['b', f64]], f64, (c, a, b) => call_ref(c, [a, b]))],
                ['f', fn([['a', f64], ['b', f64]], f64, (a, b) => call('self', 'apply', [codeOf('sum'), a, b]))],
            ],
            exports: ['f'],
        }
        const checked = assertOk(check(m))
        assertEq(show(checked.functions[1][1].body[0]), 'f64')
        assertEq(show(checked.functions[2][1].params[0][1]), 'f64')
        assertEq(show(assertOk(check({
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['f', fn([], bin, codeOf('sum'))],
            ],
            exports: [],
        })).functions[1][1].body[0]), 'code([f64, f64], f64)')
        assertEq(why({
            imports: [],
            functions: [['f', fn([], bin, codeOf('g'))]],
            exports: [],
        }), 'f: no function g')
        assertEq(why({
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['f', fn([['a', f64]], f64, a => call_ref(codeOf('sum'), [a]))],
            ],
            exports: [],
        }), 'f: call_ref takes 2 arguments, not 1')
        assertEq(why({
            imports: [],
            functions: [['f', fn([['a', f64]], f64, a => call_ref(a, []))]],
            exports: [],
        }), 'f: call_ref of f64, which is no code')
        assertEq(why({
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['f', fn([['a', bool], ['b', f64]], f64, (a, b) => call_ref(codeOf('sum'), [a, b]))],
            ],
            exports: [],
        }), "f: call_ref's argument 0 is f64, not bool")
        assertEq(why({
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['f', fn([], f64, call_ref(get('c'), [lit(f64, 1), lit(f64, 2)]))],
            ],
            exports: [],
        }), 'f: no local c')
        assertEq(why({
            imports: [],
            functions: [
                ['sum', fn([['a', f64], ['b', f64]], f64, (a, b) => add(a, b))],
                ['f', fn([], f64, call_ref(codeOf('sum'), [get('a'), lit(f64, 2)]))],
            ],
            exports: [],
        }), 'f: no local a')
        assertEq(why({
            imports: [],
            functions: [['f', fn([['c', code([['own', f64]], f64)]], f64, c => call_ref(c, [lit(f64, 1)]))]],
            exports: [],
        }), 'f: a code parameter is own, and f64 is not sealed, so there is nothing to own')
        assertEq(why({
            imports: [],
            functions: [['f', fn([['c', code([['borrow', never]], f64)]], f64, c => call_ref(c, [trap('no')]))]],
            exports: [],
        }), 'f: a code parameter is never, so no call reaches the function')
        assertEq(why({
            imports: [],
            functions: [['f', fn([['c', code([['borrow', int(1n, 0n)]], f64)]], f64, c => call_ref(c, [n(1n)]))]],
            exports: [],
        }), 'f: int(1, 0) is empty')
        // A code of a function with an `own` parameter, and a code that answers unit.
        assertOk(check({
            imports: l0,
            functions: [
                ['g', fn([own('v', any)], unit, call('Any', 'drop', [get('v')]))],
                ['f', fn([], code([['own', any]], unit), codeOf('g'))],
            ],
            exports: [],
        }))
        assertOk(check({
            imports: [],
            functions: [
                ['none', fn([['a', f64]], unit, make([]))],
                ['f', fn([['c', code([['borrow', f64]], unit)]], unit, c => call_ref(c, [lit(f64, 1)]))],
            ],
            exports: [],
        }))
        // A `call_ref` of a known `code(f)` inherits `f`'s effect.
        assertEq(assertOk(check({
            imports: [],
            functions: [
                ['die', fn([], never, trap('die'))],
                ['f', fn([], never, call_ref(codeOf('die'), []))],
            ],
            exports: [],
        })).functions[1][1].fails, true)
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
    // A branch on a comparison of integers sees each operand that is a local at the range that the other's allows,
    // and so does a branch on its negation; nothing else narrows a local.
    refinement: () => {
        const s = get('s')
        const k = get('k')
        const b = get('b')
        const p = /** @type {const} */ ([['s', u(8)], ['k', int(0n, 100n)], ['b', u(64)], ['x', f64]])
        /** The type of a body over `p`. @type {(body: Term) => string} */
        const typed = body => bodyType(one(p, u(64), body))
        // lt and le, in either branch, with the local on either side
        assertEq(typed(if_(lt(s, n(10n)), s, n(0n))), 'int(0, 9)')
        assertEq(typed(if_(lt(s, n(10n)), n(10n), s)), 'int(10, 255)')
        assertEq(typed(if_(le(s, n(10n)), s, n(0n))), 'int(0, 10)')
        assertEq(typed(if_(le(s, n(10n)), n(11n), s)), 'int(11, 255)')
        assertEq(typed(if_(lt(n(10n), s), s, n(11n))), 'int(11, 255)')
        assertEq(typed(if_(le(n(10n), s), n(9n), s)), 'int(0, 9)')
        // both operands are locals, each bounded by the other's range
        assertEq(typed(if_(lt(s, k), s, n(0n))), 'int(0, 99)')
        assertEq(typed(if_(lt(s, k), k, n(1n))), 'int(1, 100)')
        assertEq(typed(if_(lt(s, k), n(0n), k)), 'int(0, 100)')
        assertEq(typed(if_(le(s, k), n(101n), s)), 'int(1, 255)')
        assertEq(typed(if_(le(s, k), n(0n), k)), 'int(0, 100)')
        // an eq that holds leaves the overlap; one that does not takes a single value off an end only
        assertEq(typed(if_(eq(s, n(3n)), s, n(3n))), 'int(3, 3)')
        assertEq(typed(if_(eq(s, k), s, n(0n))), 'int(0, 100)')
        assertEq(typed(if_(eq(b, n(0n)), n(1n), b)), 'int(1, 18446744073709551615)')
        assertEq(typed(if_(eq(n(255n), s), n(0n), s)), 'int(0, 254)')
        assertEq(typed(if_(eq(s, n(3n)), n(0n), s)), 'u(8)')
        assertEq(typed(if_(eq(s, k), n(0n), s)), 'u(8)')
        // a negation, as not and ne write it, swaps the branches; refinements nest
        assertEq(typed(if_(ne(b, n(0n)), b, n(1n))), 'int(1, 18446744073709551615)')
        assertEq(typed(if_(not(lt(s, n(10n))), s, n(10n))), 'int(10, 255)')
        assertEq(typed(if_(lt(s, n(10n)), if_(le(n(5n), s), s, n(5n)), n(5n))), 'int(5, 9)')
        // a 33-bit sum that its check fits back into 32 bits, as an allocator's pointer
        assertEq(bodyType(one([['a', u(32)], ['c', u(32)]], u(32), let_('q', add(get('a'), get('c')), q => if_(le(q, n(0xFFFF_FFFFn)), q, n(0n))))), 'u(32)')
        // nothing else narrows: an empty range, floats, an operand that is no local, an arm of both outcomes,
        // and a match whose arms are not all bool literals
        assertEq(typed(if_(lt(s, n(0n)), s, n(0n))), 'u(8)')
        assertEq(bodyType(one(p, f64, if_(lt(x, one_), x, one_))), 'f64')
        assertEq(typed(if_(lt(add(s, n(1n)), n(10n)), s, n(0n))), 'u(8)')
        assertEq(typed(match(lt(s, n(10n)), [[null, null, s]])), 'u(8)')
        assertEq(typed(if_(match(lt(s, n(10n)), [[['true'], null, true_], [['false'], null, lt(s, n(5n))]]), s, n(0n))), 'u(8)')
        assertEq(typed(if_(match(lt(s, n(10n)), [[['true'], null, true_], [['false'], null, true_]]), s, n(0n))), 'u(8)')
        // without the check, the sum is refused
        assertEq(why(one([['a', u(32)], ['c', u(32)]], u(32), add(get('a'), get('c')))), 'f: the body is int(0, 8589934590), not u(32)')
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
        // `else` is written out as the kinds it takes, and each arm keeps the variants as the term wrote them.
        const [, body] = functions[0][1].body
        assert(body[0] === 'match')
        const [, , arms] = body
        assertEq(arms.map(([vs]) => vs.join(' | ')).join(', '), 'boolean, number, string, bigint, array | object | function, undefined | null')
        assertEq(arms.map(([, , , written]) => written === null ? 'else' : written.join(' | ')).join(', '), 'boolean, number, string, bigint, array | object | function, else')
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
        // A dup answers its argument's type, so it keeps a narrower one.
        assertEq(kindsOf(p, cast(only(any, 'number'), v, 'x', x => call('Any', 'dup', [x]))), 'any.only(number)')
        assertEq(bodyType(overL0(p, f64, cast(only(any, 'number'), v, 'x', x => call('Any', 'to_f64', [x])))), 'f64c')
        // What a module may not write.
        assertEq(why(one(p, f64, one_)), 'f: no interface Any')
        assertEq(why(overL0([['v', sealed('Any', 'nope')]], f64, one_)), 'f: Any has no type nope')
        assertEq(why(overL0([['v', only(any)]], f64, one_)), 'f: any.only() holds no value')
        assertEq(why(overL0([['v', only(any, 'symbol')]], f64, one_)), 'f: any has no variant symbol')
        assertEq(why(overL0([['v', only(any, 'null', 'null')]], f64, one_)), 'f: any.only(null, null) names null twice')
        // Returning a borrowed parameter as an owned result is refused by the owned stage.
        assertEq(why(overL0(p, any, v)), 'f: the result is borrowed, and its caller would own it')
        assertEq(why(overL0(p, f64, lit(any, 1n))), 'f: 1 is not a literal of any')
        assertEq(why(overL0(p, f64, add(v, v))), 'f: add of any and any: an operator takes integers or floats')
        // A call of an interface takes its arguments at the kinds of its parameters.
        assertEq(why(overL0(p, f64, call('Any', 'to_f64', [v]))), "f: Any.to_f64's v is any.only(number), not any")
        assertEq(why(overL0(p, f64, call('Any', 'nope', [v]))), 'f: Any has no function nope')
        assertEq(why(overL0(p, f64, call('Any', 'kind', []))), 'f: Any.kind takes one argument, not 0')
        // An owned result is allowed; the body's type still has to match.
        assertEq(why(overL0(p, f64, call('Make', 'any', []), [['Make', { abi: 'test', types: [], functions: [['any', signature([], any)]] }]])),
            'f: the body is any, not f64')
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
        // A match reads the tag that the type's kind answers, so a builder, which names none, is matched by nothing.
        assertEq(why(overL0([own('b', builder)], f64, match(get('b'), [[['builder'], null, one_]]))), 'f: a match needs the tag of builder, and Containers names no kind for it')
    },
    // A string literal is a value of the type whose interface makes it, of the one variant that it makes.
    literals: () => {
        assertEq(kindsOf([], lit(string, 'abc')), 'any.only(string)')
        assertEq(bodyType(overL0([], u(31), call('String', 'length', [lit(string, '')]))), 'u(31)')
        assertEq(why(overL0([], f64, lit(any, 'a'))), 'f: a string literal is any.only(string), not any')
        assertEq(why(overL0([], f64, lit(only(any, 'number'), 'a'))), 'f: a string literal is any.only(string), not any.only(number)')
        assertEq(why(overL0([], f64, lit(f64, 'a'))), 'f: "a" is not a literal of f64')
        // A type whose interface names no maker has no literals, and the maker's module is one that the module imports.
        const other = /** @type {Interface} */ ({ abi: 'test', types: [['x', { variants: ['a'], kind: 'k', carrier: 'i32' }]], functions: [['k', signature([['x', sealed('Other', 'x')]], int(0n, 0n))]] })
        assertEq(why(overL0([], f64, lit(sealed('Other', 'x'), 'a'), [['Other', other]])), 'f: x has no literals')
        assertEq(why({ imports: l0.filter(([k]) => k !== 'String'), functions: [['f', fn([], bool, let_('s', lit(string, 'a'), () => true_))]], exports: [] }),
            'f: String makes the literals of any, and the module does not import String')
        // The variant of an interface's literals is one of its type's variants.
        const making = /** @type {(variant: string) => Interface} */ (variant => ({
            abi: 'test:label',
            types: [['label', { variants: ['text', 'other'], kind: 'k', carrier: 'i32', literal: { variant, module: 'Label', member: 'make' } }]],
            functions: [['k', signature([['l', sealed('Label', 'label')]], int(0n, 1n))]],
        }))
        assertEq(why({ imports: [...l0, ['Label', making('none')]], functions: [], exports: [] }), "Label: label's literals hold none, which is none of its variants")
        // The maker is an import of its interface's ABI, and that ABI's memory and data_base are the loader's.
        assertEq(why(importing({ abi: 'fjs:l0', types: [], constants: [['memory', f64]], functions: [] })),
            'the constant Bad.memory is the import memory of fjs:l0, which the loader gives a module that makes literals')
        assertEq(why(importing({ abi: 'fjs:l0', types: [], functions: [['data_base', signature([], f64)]] })),
            'the function Bad.data_base is the import data_base of fjs:l0, which the loader gives a module that makes literals')
        assertEq(why(importing({ abi: 'fjs:l0', types: [], constants: [['make_string', f64]], functions: [] })),
            'the constant Bad.make_string and the function String.make_string are both the import make_string of fjs:l0')
        assertOk(check(importing({ abi: 'test:bad', types: [], constants: [['memory', f64]], functions: [['data_base', signature([], f64)]] })))
        // The first interface's ABI gives the loader's table and table_base, so no constant or function of it has either name.
        assertEq(why(importing({ abi: 'fjs:l0', types: [], functions: [['table', signature([], f64)]] })),
            'the function Bad.table is the import table of fjs:l0, which the loader gives a module that holds code')
        assertEq(why(importing({ abi: 'fjs:l0', types: [], constants: [['table_base', f64]], functions: [] })),
            'the constant Bad.table_base is the import table_base of fjs:l0, which the loader gives a module that holds code')
        assertOk(check(importing({ abi: 'test:bad', types: [], constants: [['table', f64]], functions: [['table_base', signature([], f64)]] })))
        // Two interfaces may make literals of one spelling, each of its own type.
        assertOk(check({ imports: [...l0, ['Label', making('text')]], functions: [['f', fn([], bool, let_('l', lit(only(sealed('Label', 'label'), 'text'), 'a'), () => true_))]], exports: [] }))
        // The emitter imports a maker once for its ABI and its name, so the types whose literals it makes share its carrier.
        /** An interface of a type of `carrier` whose literals String's `make_string` makes. @type {(carrier: 'i32' | 'i64') => Interface} */
        const sharing = carrier => ({
            abi: 'test:label',
            types: [['label', { variants: ['text'], kind: 'k', carrier, literal: { variant: 'text', module: 'String', member: 'make_string' } }]],
            functions: [['k', signature([['l', sealed('Label', 'label')]], int(0n, 0n))]],
        })
        assertEq(why({ imports: [...l0, ['Label', sharing('i32')]], functions: [], exports: [] }),
            'the literals of Any.any, carried by i64, and of Label.label, carried by i32, are both made by the import make_string of fjs:l0, which answers one WASM value')
        assertOk(check({ imports: [...l0, ['Label', sharing('i64')]], functions: [], exports: [] }))
        // A type of one variant holds the values of that variant alone, so a literal of it may name the type in full.
        const label = sealed('Label', 'label')
        assertOk(check({ imports: [...l0, ['Label', sharing('i64')]], functions: [['f', fn([], bool, let_('l', lit(label, 'a'), () => let_('m', lit(only(label, 'text'), 'b'), () => true_)))]], exports: [] }))
    },
    // The plain stage reads a value of a sealed type as often as it needs: `checkPlain` types it, and `check` refuses what it leaves over.
    plain: () => {
        const m = overL0([['c', u(16)]], u(31), let_('s', call('String', 'from_unit', [get('c')]), s => call('String', 'length', [s])))
        assertEq(show(assertOk(checkPlain(m)).functions[0][1].body[0]), 'u(31)')
        assertEq(why(m), 'f: s is left over')
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
        assertEq(why(importing(tagged([own('x', t)], u(1)))), untagged)
        // A callee owns a value of a sealed type, and nothing else.
        assertEq(why(importing({ abi: 'test', types: [], functions: [['f', signature([own('x', f64)], f64)]] })), 'Bad: x is own, and f64 is not sealed, so there is nothing to own')
        // A counted type names a dup that borrows a value and answers one, and a drop that owns one and answers unit.
        /** An interface of `t`, counted by the functions `d` and `r` as they are given. @type {(dup: string | undefined, drop: string | undefined, functions: Interface['functions']) => Interface} */
        const counted = (dup, drop, functions) => ({
            abi: 'test',
            types: [['t', { variants: ['a', 'b'], kind: 'k', carrier: 'i32', ...(dup === undefined ? {} : { dup }), ...(drop === undefined ? {} : { drop }) }]],
            functions: [['k', signature([['x', t]], u(1))], ...functions],
        })
        const d = /** @type {const} */ (['d', signature([['x', t]], t)])
        const r = /** @type {const} */ (['r', signature([own('x', t)], unit)])
        assertEq(assertOk(check(importing(counted('d', 'r', [d, r])))).imports.length, 6)
        assertEq(why(importing(counted('d', undefined, [d]))), 'Bad: t names a dup and no drop, and a counted type names both')
        assertEq(why(importing(counted(undefined, 'r', [r]))), 'Bad: t names a drop and no dup, and a counted type names both')
        const miscounted = "Bad: t's dup borrows a value of the type and answers one, and its drop owns one and answers unit"
        assertEq(why(importing(counted('d', 'r', [['d', signature([['x', t]], f64)], r]))), miscounted)
        assertEq(why(importing(counted('d', 'r', [d, ['r', signature([['x', t]], unit)]]))), miscounted)
        assertEq(why(importing(counted('d', 'r', [d]))), miscounted)
        // A counted type may name copy variants, each one of its variants once, and a linear type names none.
        /** `counted('d', 'r', [d, r])` with `copy` as its copy variants. @type {(copy: readonly string[]) => Interface} */
        const copying = copy => {
            const i = counted('d', 'r', [d, r])
            return { ...i, types: i.types.map(([k, def]) => /** @type {const} */ ([k, { ...def, copy }])) }
        }
        assertEq(assertOk(check(importing(copying(['b'])))).imports.length, 6)
        assertEq(why(importing(copying(['c']))), "Bad: t's copy variants are its variants, each once")
        assertEq(why(importing(copying(['a', 'a']))), "Bad: t's copy variants are its variants, each once")
        assertEq(why(importing({ abi: 'test', types: [['t', { variants: ['a'], carrier: 'i32', copy: ['a'] }]], functions: [] })), 'Bad: t names copy variants, and only a counted type has them')
        // A function that gives back a parameter owns it, and the parameter is of the function's result.
        /** An interface of a function `g` of `params` that answers `result` and gives back `x`. @type {(params: readonly Param[], result: Type) => Interface} */
        const giving = (params, result) => ({ abi: 'test', types: [], functions: [['g', signature(params, result, 'x')]] })
        const unreturned = /** @type {const} */ ('Bad: g gives back x, which is no parameter that it owns of the type of its result')
        assertEq(assertOk(check(importing(giving([['y', any], own('x', any)], any)))).imports.length, 6)
        assertEq(why(importing(giving([own('y', any)], any))), unreturned)
        assertEq(why(importing(giving([['x', any]], any))), unreturned)
        assertEq(why(importing(giving([own('x', any)], string))), unreturned)
        // A function that answers never fails, so it says that it may.
        assertEq(why(importing({ abi: 'test', types: [], functions: [['g', signature([own('v', any)], never)]] })), 'Bad: g answers never, so it fails, and it does not say that it may')
        assertEq(assertOk(check(importing({ abi: 'test', types: [], functions: [['g', mayFail(signature([own('v', any)], never))]] }))).imports.length, 6)
        // A type that names no kind has no tag, and a linear one names no dup and no drop.
        assertEq(assertOk(check(importing({ abi: 'test', types: [['t', { variants: ['a'], carrier: 'i32' }]], functions: [] }))).imports.length, 6)
        // The scope of a term passes the same rules: a local may be a product, and a function's result may not.
        const scope = { name: 'f', locals: /** @type {const} */ ([['a', product([['s', ['sum', [['x', unit]]]]])]]), result: f64, functions: [], imports: [] }
        assertEq(assertError(typeOf(scope)(one_)), 'f: sum({ x: unit }) is not in this slice')
        assertEq(show(assertOk(typeOf({ ...scope, locals: [['a', unit]] })(get('a')))), 'unit')
        assertEq(assertError(typeOf({ ...scope, locals: [], result: unit })(one_)), 'f: unit is not in this slice')
        assertEq(assertError(typeOf({ ...scope, locals: [], functions: [['g', signature([['b', unit]], f64)]] })(one_)), 'g: unit is not in this slice')
    },
    // L0's Memory says instructions, so the target binds its functions with instructions of its own, and an interface
    // that says so is Memory or a part of it, with its ABI and its signatures, under any name
    // (heap.md, Memory in the IR). The memory that its functions touch is the loader's, from its ABI.
    memory: () => {
        const [, { functions: all }] = memory
        const pages = int(0n, 0x1_0000n)
        // Loads, stores, size and grow are calls that cannot fail, so neither can a function that makes them.
        assertEq(assertOk(check({
            imports: [memory],
            functions: [
                ['peek', fn([['a', u(32)]], u(8), a => call('Memory', 'load8', [a]))],
                ['poke', fn([['a', u(32)], ['v', u(64)]], u(64), (a, v) => let_('stored', call('Memory', 'store64', [a, v]), () => call('Memory', 'load64', [a])))],
                ['grown', fn([], pages, let_('before', call('Memory', 'grow', [n(1n)]), () => call('Memory', 'size', [])))],
            ],
            exports: [],
        })).functions.map(([k, f]) => `${k}: ${show(f.body[0])} ${f.fails}`).join(', '), 'peek: u(8) false, poke: u(64) false, grown: int(0, 65536) false')
        /** The part of Memory of the functions that `names` names. @type {(names: readonly string[]) => Interface} */
        const part = names => ({ abi: 'fjs:l0', instructions: true, types: [], functions: all.filter(([k]) => names.includes(k)) })
        // A part of Memory under a name of its own says instructions too, beside Memory or alone, and the names of
        // its parameters are its own.
        assertOk(check({ imports: [memory, ['Bytes', part(['load8', 'store8'])]], functions: [['f', fn([['a', u(32)]], u(8), a => call('Bytes', 'load8', [a]))]], exports: [] }))
        const load8 = signature([['a', u(32)]], u(8))
        assertOk(check(importing({ ...part([]), functions: [['load8', signature([['address', u(32)]], u(8))]] })))
        /** Why the checker refuses `part(['load8'])` with `i` over it, beside L0. @type {(i: Partial<Interface>) => string} */
        const bad = i => why(importing({ ...part(['load8']), ...i }))
        assertEq(bad({ abi: 'test:bad' }), "Bad says instructions, so it is L0's Memory, of fjs:l0, not of test:bad")
        const unmade = 'Bad says instructions, so it has no types and no constants, which the target would not make'
        assertEq(bad({ types: [['t', { variants: ['a'], carrier: 'i32' }]] }), unmade)
        assertEq(bad({ constants: [['c', f64]] }), unmade)
        assertEq(bad({ functions: [['peek', load8]] }), "Bad says instructions, and peek is no function of L0's Memory, which the target binds")
        /** Why Bad's `load8`, shown as `s`, is not Memory's. @type {(s: string) => string} */
        const unlike = s => `Bad.load8 is L0's Memory.load8, which is (a: u(32)) -> u(8), not ${s}`
        assertEq(bad({ functions: [['load8', signature([['a', u(32)]], u(16))]] }), unlike('(a: u(32)) -> u(16)'))
        assertEq(bad({ functions: [['load8', signature([own('a', u(32))], u(8))]] }), unlike('(own a: u(32)) -> u(8)'))
        // A mark is a part of the signature: what it gives back, whether it may fail, and how it counts on bits.
        assertEq(bad({ functions: [['load8', signature([['a', u(32)]], u(8), 'a')]] }), unlike('(a: u(32)) -> u(8), gives back a'))
        assertEq(bad({ functions: [['load8', mayFail(load8)]] }), unlike('(a: u(32)) -> u(8), may fail'))
        assertEq(bad({ functions: [['load8', countsBits('dup', load8)]] }), unlike('(a: u(32)) -> u(8), counts dup'))
        // A host makes a literal, so no function that the target binds makes one.
        const label = sealed('Label', 'label')
        /** An interface of a type of one variant, whose literals `module`'s `member` makes, and of `functions`. @type {(module: string, member: string, functions: Interface['functions']) => Interface} */
        const labels = (module, member, functions) => ({ abi: 'test:label', types: [['label', { variants: ['text'], carrier: 'i64', literal: { variant: 'text', module, member } }]], functions })
        assertEq(why({ imports: [memory, ['Label', labels('Memory', 'load64', [])]], functions: [['f', fn([], bool, let_('l', lit(label, 'a'), () => true_))]], exports: [] }),
            "f: Memory makes the literals of label, and it says instructions, so its functions are the target's, and none makes a literal")
        // The loader gives the memory from Memory's ABI, so no constant or function of that ABI is named memory, and it
        // gives data_base only to a module that makes literals.
        /** A module that imports Memory and `i`, as Bad. @type {(i: Interface) => Module} */
        const beside = i => ({ imports: [memory, ['Bad', i]], functions: [], exports: [] })
        assertEq(why(beside({ abi: 'fjs:l0', types: [], functions: [['memory', signature([], f64)]] })),
            'the function Bad.memory is the import memory of fjs:l0, which the loader gives a module that touches the memory')
        assertEq(why(beside({ abi: 'fjs:l0', types: [], constants: [['memory', f64]], functions: [] })),
            'the constant Bad.memory is the import memory of fjs:l0, which the loader gives a module that touches the memory')
        assertOk(check(beside({ abi: 'fjs:l0', types: [], constants: [['data_base', f64]], functions: [] })))
        // A module imports one memory, so the literals that it makes are made in Memory's, as L0's are.
        assertEq(why(beside(labels('Bad', 'make', [['make', signature([['p', u(32)], ['n', u(32)]], sealed('Bad', 'label'))]]))),
            'the literals of Bad.label are made in the memory of test:label, and Memory touches the memory of fjs:l0, but a module imports one memory')
        assertOk(check({ imports: [...l0, memory], functions: [], exports: [] }))
    },
    // The checker infers whether each function may fail: by a trap or a throw in it, by a call of an interface's function
    // that may fail, or by a call of the module's that may, to a fixed point. Functions that call each other and nothing
    // that may fail cannot, and neither does a module's plain stage change the bits.
    effect: () => {
        /** @type {(m: Module) => string} */
        const bits = m => assertOk(checkPlain(m)).functions.map(([k, { fails }]) => `${k}: ${fails}`).join(', ')
        assertEq(bits(throws), 'ownedLength: true, rethrow: true, doubled: true, checked: true, viaCallee: true, unitOf: true, kindOf: false')
        const x = get('x')
        /** @type {(name: string, body: Term) => readonly [string, ReturnType<typeof fn>]} */
        const f = (name, body) => [name, fn([['x', f64]], f64, body)]
        /** @type {(name: string) => Term} */
        const to = name => call('self', name, [x])
        assertEq(bits({ imports: l0, functions: [
            f('a', to('b')), f('b', to('c')), f('c', if_(lt(x, x), trap('no'), x)),
            f('d', to('e')), f('e', to('d')), f('g', to('g')), f('h', add(to('d'), to('a'))),
        ], exports: [] }), 'a: true, b: true, c: true, d: false, e: false, g: false, h: true')
        // A trap on misuse adds nothing, so a call of a function that has only one cannot fail either; a trap beside it still may.
        assertEq(bits({ imports: l0, functions: [
            f('m', if_(lt(x, x), misuse('no'), x)), f('p', to('m')), f('q', if_(lt(x, x), misuse('no'), trap('no'))),
        ], exports: [] }), 'm: false, p: false, q: true')
        assertEq(bits({ imports: l0, functions: [['k', fn([['v', any]], never, v => throw_(call('Any', 'dup', [v])))]], exports: [] }), 'k: true')
        assertEq(bits(samples).includes('true'), false)
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
    // A bit operator takes unsigned integers, and its range is exact: `and`
    // within the smaller bound, `or` and `xor` within the ones of the larger,
    // a shift at both ends by a count below 64.
    bits: () => {
        assertEq(assertOk(check(bits)).functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '), [
            'mask: u(16)', 'either: u(32)', 'flip: u(64)', 'reference: u(52)', 'shifted: u(15)', 'drained: u(32)', 'nibble: u(4)',
            'bitsOf: u(64)', 'ofBits: f64', 'signOf: u(1)', 'negBits: u(64)',
        ].join(', '))
        const p = /** @type {const} */ ([['a', int(2n, 5n)], ['x', f64], ['k', int(1n, 2n)]])
        const a = get('a')
        assertEq(bodyType(one(p, u(64), shl(a, n(3n)))), 'int(16, 40)')
        assertEq(bodyType(one(p, u(64), shr(a, get('k')))), 'int(0, 2)')
        assertEq(why(one(p, u(64), and(a, n(-1n)))), 'f: and of int(2, 5) and int(-1, -1): a bit operator takes unsigned integers')
        assertEq(why(one(p, u(64), shl(a, n(64n)))), 'f: shl of int(2, 5) by int(64, 64): a shift count is below 64')
        assertEq(why(one(p, u(64), shl(a, n(62n)))), 'f: shl of int(2, 5) and int(62, 62) is int(0, 23058430092136939520), which needs more than one word')
        assertEq(bodyType(one(p, u(64), and(a, n(255n)))), 'int(0, 5)')
        for (const [name, f] of /** @type {const} */ ([['and', and], ['or', or], ['xor', xor], ['shl', shl], ['shr', shr]])) {
            assertEq(why(one(p, u(64), f(get('x'), get('x')))), `f: ${name} of f64: a bit operator takes unsigned integers`)
        }
        assertEq(why(one(p, u(64), to_bits(a))), 'f: to_bits of int(2, 5): to_bits takes a float')
        assertEq(why(one(p, u(64), to_bits(get('x')))), 'f: to_bits of f64: to_bits takes an f64c, whose one NaN has one bit pattern')
        assertEq(bodyType(one(p, u(64), to_bits(one_))), 'u(64)')
        assertEq(bodyType(one(p, u(64), to_bits(canon(get('x'))))), 'u(64)')
        assertEq(why(one(p, u(64), canon(a))), 'f: canon of int(2, 5): canon takes a float')
        assertEq(why(one(p, f64, ['op', 'canon', [get('x'), get('x')]])), 'f: canon takes one operand, not 2')
        assertEq(bodyType(one(p, u(64), or(n(0n), n(0n)))), 'int(0, 0)')
        assertEq(why(one(p, f64, from_bits(get('x')))), 'f: from_bits of f64: from_bits takes an unsigned integer')
        assertEq(why(one(p, f64, from_bits(n(-1n)))), 'f: from_bits of int(-1, -1): from_bits takes an unsigned integer')
        assertEq(why(one(p, f64, ['op', 'to_bits', [get('x'), get('x')]])), 'f: to_bits takes one operand, not 2')
    },
    // Only the module that defines Any sees `any`'s carrier, and `seal`
    // makes a value of a type that it may write from its carrier's bits.
    seal: () => {
        assertEq(assertOk(check(sealing)).functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '),
            'carrierOf: u(64), isReference: bool, boxOf: any.only(number)')
        assertEq(definedBy(assertOk(check(sealing))), 'Any')
        assertEq(assertOk(check(tagging)).functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '), 'tag: u(1), size: int(1, 2)')
        /** `tagging` with its kind named `name` and written as `body`. @type {(name: string, body: (v: Term) => Term) => Module} */
        const tagged = (name, body) => {
            const [[, size], [, def]] = [assertNotNullish(tagging.functions.find(([k]) => k === 'size')), assertNotNullish(tagging.defines).types[0]]
            return { ...tagging, defines: { name: 'T', types: [['cell', { ...def, kind: name }]] }, functions: [[name, fn([['v', ['sealed', 'T', 'cell', null]]], int(0n, 1n), body)], ['size', size]] }
        }
        // a match calls the kind that the module defines, and fails where it may
        assertEq(assertOk(check(tagged('tag', () => trap('no tag')))).functions.map(([k, f]) => `${k}: ${f.fails}`).join(', '), 'tag: true, size: true')
        // a match of one variant tests no tag, so it calls no kind
        const cellOf = /** @type {const} */ (['sealed', 'T', 'cell', null])
        const narrow = tagged('tag', () => trap('no tag'))
        assertEq(assertOk(check({ ...narrow, functions: [...narrow.functions, ['one', fn([['v', ['sealed', 'T', 'cell', ['big']]]], u(8), v => match(v, [[null, null, n(2n)]]))]] }))
            .functions.map(([k, f]) => `${k}: ${f.fails}`).join(', '), 'tag: true, size: true, one: false')
        // a constant that matches a cell reads what its kind reads
        assertEq(why({
            ...tagged('tag', v => and(unseal(v), constant('self', 'mask'))),
            constants: [
                ['size0', { type: u(8), value: match(seal(cellOf, n(0n)), [[['small'], null, n(1n)], [['big'], null, n(2n)]]) }],
                ['mask', { type: int(0n, 1n), value: n(1n) }],
            ],
        }), 'size0: mask is read before init evaluates it')
        // a value that seal makes is owned, so two parameters that own it do not both take it
        const taker = tagged('tag', v => and(unseal(v), n(1n)))
        assertEq(why({ ...taker, functions: [...taker.functions,
            ['eat', fn([own('v', cellOf)], cellOf, v => v)],
            ['twice', fn([['b', u(64)]], cellOf, b => let_('x', seal(cellOf, b), x => let_('y', call('self', 'eat', [x]), () => call('self', 'eat', [x]))))],
        ] }), 'twice: x is used after it was consumed')
        assertEq(why({ ...taker, functions: [...taker.functions, ['peek', fn([['b', u(64)]], u(64), b => unseal(seal(cellOf, b)))]] }),
            'peek: seal answers an owned value that nothing takes over: bind it first')
        // the makers of a defined type's literals are linked as imports are
        assertEq(why({
            imports: [['M', { abi: 'm', types: [], functions: [['memory', signature([], u(8))], ['make', signature([['p', u(32)], ['n', u(32)]], ['sealed', 'T', 'cell', null])]] }]],
            defines: { name: 'T', types: [['cell', { variants: ['small'], carrier: 'i64', literal: { variant: 'small', module: 'M', member: 'make' } }]] },
            functions: [],
            exports: [],
        }), 'the function M.memory is the import memory of m, which the loader gives a module that makes literals')
        // the loader's names are for what a module imports, not for its own functions
        assertEq(assertOk(check(tagged('table', v => and(unseal(v), n(1n))))).functions.map(([k]) => k).join(), 'table,size')
        const defines = assertNotNullish(sealing.defines)
        /** A module of one function, `f`, that defines Any as `sealing` does. @type {(params: readonly Param[], result: Type, body: Term) => Module} */
        const sealed = (params, result, body) => ({ ...one(params, result, body), defines })
        const v = get('v')
        const p = /** @type {const} */ ([['v', any], ['b', u(64)], ['x', f64]])
        const num = only(any, 'number')
        assertEq(why(overL0(p, u(64), unseal(v))), 'f: unseal of any: only the module that defines Any sees its carrier')
        assertEq(why(overL0(p, num, seal(num, get('b')))), 'f: seal of any.only(number): only the module that defines Any sees its carrier')
        assertEq(why({ ...overL0(p, u(64), unseal(v)), defines }), 'the module defines Any, so it does not import Any')
        assertEq(why({ ...sealed([], u(8), n(0n)), defines: { name: 'Any', types: [['any', { variants: ['string'], carrier: 'i64', literal: { variant: 'string', module: 'Any', member: 'make' } }]] } }),
            'Any.any: the module that defines it does not make its literals')
        assertEq(why({ ...sealed([], u(8), n(0n)), defines: { name: 'Any', types: [['any', { variants: ['string'], carrier: 'i64', dup: 'dup', drop: 'drop' }]] } }),
            "Any.any's dup is (b: u(64)) -> u(64), over its carrier's bits")
        assertEq(bodyType({ ...one([['v', any]], u(32), unseal(v)), defines: { name: 'Any', types: [['any', { variants: ['string'], carrier: 'i32' }]] } }), 'u(32)')
        assertEq(why({ ...sealed([], u(8), n(0n)), defines: { name: 'self', types: [] } }), 'self is the module itself, so no interface has that name')
        assertEq(why(sealed(p, u(64), call('Any', 'kind', [v]))), 'f: Any is the module itself, which names its function self.kind')
        assertEq(why(sealed(p, u(64), unseal(get('b')))), 'f: unseal of u(64): unseal takes a value of a sealed type')
        assertEq(why(sealed(p, u(64), ['op', 'unseal', [v, v]])), 'f: unseal takes one operand, not 2')
        assertEq(why(sealed(p, num, ['op', 'seal', [get('b')]])), 'f: seal takes the sealed type that it makes')
        assertEq(why(sealed(p, num, ['op', 'seal', [get('b')], u(8)])), 'f: seal takes the sealed type that it makes')
        assertEq(why(sealed(p, num, ['op', 'seal', [get('b'), get('b')], num])), 'f: seal takes one operand, not 2')
        assertEq(why(sealed(p, num, seal(only(any, 'nothing'), get('b')))), 'f: any has no variant nothing')
        assertEq(why(sealed(p, num, seal(num, get('x')))), 'f: seal of f64: any.only(number) is made of u(64)')
        assertEq(why(sealed(p, num, seal(num, n(-1n)))), 'f: seal of int(-1, -1): any.only(number) is made of u(64)')
        assertEq(why(sealed(p, u(64), ['op', 'unseal', [v], u(8)])), 'f: unseal takes no range')
        assertEq(why(sealed(p, u(8), ['op', 'trunc_sat', [get('x')], num])), 'f: trunc_sat takes the range that it saturates to')
    },
    // A counted type that the module defines names its dup and its drop over its carrier's bits, and only the lifetime pass calls them.
    hooks: () => {
        const cell = sealed('C', 'cell')
        const [[, def]] = assertNotNullish(counting.defines).types
        /** `counting` with its cell defined as `d`, and its functions `fs` in place of those of their names. @type {(d: Partial<import('../types.ts').SealedDef>, fs?: Module['functions']) => Module} */
        const counter = (d, fs = []) => ({
            ...counting,
            defines: { name: 'C', types: [['cell', { ...def, ...d }]] },
            functions: [...counting.functions.filter(([k]) => !fs.some(([x]) => x === k)), ...fs],
        })
        /** `counting` with one more function, `f`. @type {(params: readonly Param[], result: Type, body: Term) => Module} */
        const plus = (params, result, body) => counter({}, [['f', fn(params, result, body)]])
        assertEq(assertOk(checkPlain(counting)).functions.map(([k, f]) => `${k}: ${show(f.body[0])}`).join(', '),
            'tag: u(1), dup: u(64), drop: unit, small: cell.only(small), keep: cell, forget: int(1, 1), size: int(1, 2)')
        // the hooks, as the definition names them
        /** `counting` with its cell defined as `d` alone. @type {(d: import('../types.ts').SealedDef) => Module} */
        const only_ = d => ({ ...counting, defines: { name: 'C', types: [['cell', d]] } })
        const base = /** @type {const} */ ({ variants: ['small', 'big'], kind: 'tag', carrier: 'i64' })
        assertEq(why(only_({ ...base, dup: 'dup', copy: ['small'] })), 'C.cell names a dup and no drop, and a counted type names both')
        assertEq(why(only_({ ...base, drop: 'drop', copy: ['small'] })), 'C.cell names a drop and no dup, and a counted type names both')
        assertEq(why(only_({ ...base, copy: ['small'] })), 'C.cell names copy variants, and only a counted type has them')
        assertEq(why(counter({ copy: ['small', 'small'] })), "C.cell's copy variants are its variants, each once")
        assertEq(why(counter({ copy: ['tiny'] })), "C.cell's copy variants are its variants, each once")
        assertEq(why(counter({ dup: 'nothing' })), "C.cell's dup is (b: u(64)) -> u(64), over its carrier's bits")
        assertEq(why(counter({}, [['dup', fn([['v', cell]], cell, v => v)]])), "C.cell's dup is (b: u(64)) -> u(64), over its carrier's bits")
        assertEq(why(counter({}, [['dup', fn([own('b', u(64))], u(64), b => b)]])), "C.cell's dup is (b: u(64)) -> u(64), over its carrier's bits")
        assertEq(why(counter({}, [['drop', fn([['b', u(64)]], u(64), b => b)]])), "C.cell's drop is (b: u(64)) -> unit, over its carrier's bits")
        assertEq(why(counter({}, [['drop', fn([['b', u(64)], ['c', u(64)]], unit, () => make([]))]])), "C.cell's drop is (b: u(64)) -> unit, over its carrier's bits")
        assertEq(why(counter({ carrier: 'i32' })), "C.cell's dup is (b: u(32)) -> u(32), over its carrier's bits")
        // each hook counts one type, so a drop names the type whose value it releases
        assertEq(why({ ...counting, defines: { name: 'C', types: [['cell', def], ['other', { ...def, kind: 'tag2' }]] }, functions: [...counting.functions, ['tag2', fn([['v', sealed('C', 'other')]], int(0n, 1n), v => and(unseal(v), n(1n)))]] }),
            'C.other names dup, which is a hook already: each hook counts one type')
        assertEq(why(counter({ drop: 'dup' })), 'C.cell names dup, which is a hook already: each hook counts one type')
        // a hook is the pass's to call, so no code value names one
        assertEq(why(counter({}, [['f', fn([['b', u(64)]], u(64), b => call_ref(codeOf('drop'), [b]))]])), "f: code of drop: only the lifetime pass calls cell's drop")
        assertEq(why(counter({}, [['f', fn([['b', u(64)]], u(64), b => call_ref(codeOf('dup'), [b]))]])), "f: code of dup: only the lifetime pass calls cell's dup")
        // a hook may not fail, since the pass writes it after the effects are inferred
        assertEq(why(counter({}, [['drop', fn([['b', u(64)]], unit, () => trap('no drop'))]])), "C.cell's drop may fail, and the drops that the lifetime pass writes cannot")
        assertEq(why(counter({}, [['dup', fn([['b', u(64)]], u(64), () => trap('no dup'))]])), "C.cell's dup may fail, and the dups that the lifetime pass writes cannot")
        // but it may trap on misuse, which is no failure
        assertEq(assertOk(checkPlain(counter({}, [
            ['dup', fn([['b', u(64)]], u(64), b => if_(eq(b, n(0n)), misuse('count of 0'), b))],
            ['drop', fn([['b', u(64)]], unit, b => if_(eq(b, n(0n)), misuse('count of 0'), make([])))],
        ]))).functions.filter(([k]) => k === 'dup' || k === 'drop').map(([k, f]) => `${k}: ${f.fails}`).join(', '), 'dup: false, drop: false')
        // only the lifetime pass copies, drops, seals a counted variant and releases
        const v = get('v')
        /** Why the plain stage of a module is refused. @type {(m: Module) => string} */
        const plainWhy = m => assertError(checkPlain(m))
        const p = /** @type {const} */ ([['v', cell], ['b', u(64)]])
        /** Why `f`'s seal of a counted `t` is refused where its bits are of no form that makes no second owner. @type {(t: string) => string} */
        const unsealedWhy = t => `f: seal of ${t}: a counted ${t} is sealed from a new owner, seal(t, f(…)) or seal(t, or(c, f(…))) where f counts new, or from bits that hold no address, of literals and integers of 16 bits at most joined by or and shl: seal its copy variants, or let the pass copy`
        assertEq(plainWhy(plus(p, cell, seal(cell, get('b')))), unsealedWhy('cell'))
        assertEq(plainWhy(plus(p, only(cell, 'big'), seal(only(cell, 'big'), get('b')))), unsealedWhy('cell.only(big)'))
        assertEq(plainWhy(plus(p, cell, seal(cell, call('self', 'dup', [unseal(v)])))), 'f: seal of cell: only the lifetime pass copies a counted cell, as seal(t, self.dup(unseal(e)))')
        assertEq(plainWhy(plus(p, u(64), call('self', 'dup', [get('b')]))), "f: self.dup: only the lifetime pass calls cell's dup, in seal(t, self.dup(unseal(e)))")
        assertEq(plainWhy(plus(p, unit, call('self', 'drop', [get('b')]))), "f: self.drop: only the lifetime pass calls cell's drop")
        assertEq(plainWhy(plus([own('v', cell)], unit, call('self', 'drop', [release(v)]))), "f: self.drop: only the lifetime pass calls cell's drop")
        assertEq(plainWhy(plus([own('v', cell)], u(64), release(v))), "f: release: only the lifetime pass releases a value, as the argument of its type's drop")
        assertEq(plainWhy(plus(p, u(64), call('C', 'dup', [get('b')]))), 'f: C is the module itself, which names its function self.dup')
        // a seal of a copy variant is the module's to write
        assertEq(show(assertOk(checkPlain(plus(p, only(cell, 'small'), seal(only(cell, 'small'), get('b'))))).functions.at(-1)?.[1].body[0] ?? unit), 'cell.only(small)')
        // the owned stage has the pass's two forms, and no other
        /** `plus`, checked in its owned stage. @type {(params: readonly Param[], result: Type, body: Term) => ReturnType<typeof check>} */
        const ownedPlus = (params, result, body) => check({ ...counting, functions: [...counting.functions.filter(([k]) => ['tag', 'dup', 'drop'].includes(k)), ['f', fn(params, result, body)]], exports: [] })
        assertEq(show(assertOk(ownedPlus(p, cell, seal(cell, call('self', 'dup', [unseal(v)])))).functions.at(-1)?.[1].body[0] ?? unit), 'cell')
        assertEq(show(assertOk(ownedPlus(p, only(cell, 'big'), let_('w', match(v, [[['small'], null, trap('small')], [['big'], 'w', get('w')]]), w => seal(only(cell, 'big'), call('self', 'dup', [unseal(w)]))))).functions.at(-1)?.[1].body[0] ?? unit), 'cell.only(big)')
        assertEq(assertOk(ownedPlus([own('v', cell)], unit, call('self', 'drop', [release(v)]))).functions.length, 4)
        assertEq(assertError(ownedPlus(p, cell, seal(cell, get('b')))), unsealedWhy('cell'))
        assertEq(assertError(ownedPlus(p, cell, seal(cell, call('self', 'dup', [get('b')])))), 'f: seal of cell: the lifetime pass copies a counted cell from its bits, as seal(t, self.dup(unseal(e)))')
        assertEq(assertError(ownedPlus(p, cell, seal(cell, unseal(v)))), unsealedWhy('cell'))
        assertEq(assertError(ownedPlus(p, only(cell, 'big'), seal(only(cell, 'big'), call('self', 'dup', [unseal(v)])))), 'f: seal of cell.only(big): the copy is of cell, which cell.only(big) does not hold')
        assertEq(assertError(ownedPlus(p, u(64), call('self', 'dup', [unseal(v)]))), "f: self.dup: only the lifetime pass calls cell's dup, in seal(t, self.dup(unseal(e)))")
        // the pass's form seals only a sealed type that a module may write
        const big = let_('w', match(v, [[['small'], null, trap('small')], [['big'], 'w', get('w')]]), w => call('self', 'dup', [unseal(w)]))
        assertEq(assertError(ownedPlus(p, cell, seal(only(cell, 'big', 'bogus'), big))), 'f: cell has no variant bogus')
        assertEq(assertError(ownedPlus(p, cell, seal(only(cell, 'big', 'big'), big))), 'f: cell.only(big, big) names big twice')
        assertEq(plainWhy(plus(p, cell, seal(only(cell, 'big', 'bogus'), get('b')))), 'f: cell has no variant bogus')
        assertEq(assertError(ownedPlus([own('v', cell)], unit, call('self', 'drop', [unseal(v)]))), "f: self.drop: cell's drop takes release(x) of the value that it gives up")
        assertEq(assertError(ownedPlus([own('v', cell)], unit, call('self', 'drop', [release(v), release(v)]))), "f: self.drop: cell's drop takes release(x) of the value that it gives up")
        assertEq(assertError(ownedPlus([own('v', cell)], unit, call('self', 'drop', [['op', 'release', [v, v]]]))), "f: self.drop: cell's drop takes release(x) of the value that it gives up")
        assertEq(assertError(ownedPlus([own('v', cell), ['x', f64]], unit, call('self', 'drop', [release(get('x'))]))), "f: self.drop: release of f64, and the drop is cell's")
        assertEq(assertError(ownedPlus(p, cell, seal(cell, call('self', 'dup', [unseal(get('w'))])))), 'f: no local w')
        assertEq(assertError(ownedPlus(p, unit, call('self', 'drop', [release(get('w'))]))), 'f: no local w')
        assertEq(assertError(ownedPlus([own('v', cell)], u(64), release(v))), "f: release: only the lifetime pass releases a value, as the argument of its type's drop")
    },
    // A module seals a counted type that it defines from a new owner, straight from the call of a function that
    // counts new, tagged by a literal or not, and nowhere else takes that call's bits.
    newOwners: () => {
        const cell = sealed('C', 'cell')
        /** An interface whose `fresh` answers a new owner's bits, and whose `plain` answers bits alone. */
        const cells = /** @type {const} */ (['Cells', {
            abi: 'test:cells',
            types: [],
            functions: [['fresh', countsBits('new', signature([['n', u(8)]], u(32)))], ['plain', signature([['n', u(8)]], u(32))]],
        }])
        /** `counting`, importing `cells`, with one more function, `f`, of no parameters. @type {(result: Type, body: Term) => Module} */
        const plus = (result, body) => ({ ...counting, imports: [cells], functions: [...counting.functions, ['f', fn([], result, () => body)]] })
        /** `plus`, with only the hooks, in its owned stage. @type {(result: Type, body: Term) => ReturnType<typeof check>} */
        const owned = (result, body) => check({ ...plus(result, body), functions: [...counting.functions.filter(([k]) => ['tag', 'dup', 'drop'].includes(k)), ['f', fn([], result, () => body)]], exports: [] })
        const fresh = call('Cells', 'fresh', [n(8n)])
        const tag = n(0x7FF9_0000_0000_0002n)
        /** The type of `f`'s body where both stages take it. @type {(body: Term) => string} */
        const typed = body => {
            const plain = show(assertOk(checkPlain(plus(cell, body))).functions.at(-1)?.[1].body[0] ?? unit)
            assertEq(show(assertOk(owned(cell, body)).functions.at(-1)?.[1].body[0] ?? unit), plain)
            return plain
        }
        assertEq(typed(seal(cell, fresh)), 'cell')
        assertEq(typed(seal(cell, or(tag, fresh))), 'cell')
        assertEq(typed(seal(only(cell, 'big'), or(tag, fresh))), 'cell.only(big)')
        // its bits go straight into the seal, and nowhere else
        /** Why the plain stage of `f` is refused. @type {(result: Type, body: Term) => string} */
        const why = (result, body) => assertError(checkPlain(plus(result, body)))
        const taken = 'f: Cells.fresh counts new, so only a seal of a counted type that the module defines takes its bits, as seal(t, Cells.fresh(…)) or seal(t, or(c, Cells.fresh(…)))'
        assertEq(why(u(32), fresh), taken)
        assertEq(why(cell, let_('p', fresh, p => seal(cell, p))), taken)
        assertEq(why(cell, seal(cell, or(fresh, tag))), taken)
        assertEq(why(cell, seal(cell, or(n(0n), or(tag, fresh)))), taken)
        assertEq(why(cell, seal(cell, add(tag, fresh))), taken)
        assertEq(why(only(cell, 'small'), seal(only(cell, 'small'), fresh)), taken)
        assertEq(assertError(owned(u(32), fresh)), taken)
        // the call and its tag are typed as any are
        assertEq(why(cell, seal(cell, call('Cells', 'fresh', [n(256n)]))), "f: Cells.fresh's n is u(8), not int(256, 256)")
        assertEq(why(cell, seal(cell, or(lit(f64, 1.5), fresh))), 'f: or of f64 and u(32): the operands are integers or floats, not both')
        assertEq(why(cell, seal(cell, or(lit(int(0n, 1n << 64n), 0n), fresh))), 'f: int(0, 18446744073709551616) needs more than one word')
        // bits alone are no new owner
        assertEq(why(cell, seal(cell, call('Cells', 'plain', [n(8n)]))), 'f: seal of cell: a counted cell is sealed from a new owner, seal(t, f(…)) or seal(t, or(c, f(…))) where f counts new, or from bits that hold no address, of literals and integers of 16 bits at most joined by or and shl: seal its copy variants, or let the pass copy')
        // a seal takes one operand
        assertEq(why(cell, ['op', 'seal', [tag, fresh], cell]), 'f: seal takes one operand, not 2')
        // a function that counts new answers one word of bits and does not fail, and its names count alike
        /** `plus(cell, seal(cell, fresh))` with `fresh` of signature `s`. @type {(s: Signature) => Module} */
        const signed = s => ({ ...plus(cell, seal(cell, fresh)), imports: [['Cells', { ...cells[1], functions: [['fresh', s]] }]] })
        const answers = 'Cells: fresh counts new, so it answers one word of bits, u(64) or u(32), and does not fail'
        assertEq(show(assertOk(checkPlain(signed(countsBits('new', signature([['n', u(8)]], u(64)))))).functions.at(-1)?.[1].body[0] ?? unit), 'cell')
        assertEq(assertError(checkPlain(signed(countsBits('new', signature([['n', u(8)]], f64))))), answers)
        assertEq(assertError(checkPlain(signed(countsBits('new', signature([['n', u(8)]], u(16)))))), answers)
        assertEq(assertError(checkPlain(signed(mayFail(countsBits('new', signature([['n', u(8)]], u(32))))))), answers)
        assertEq(assertError(checkPlain({ ...plus(cell, seal(cell, fresh)), imports: [cells, ['Alias', { abi: 'test:cells', types: [], functions: [['fresh', signature([['n', u(8)]], u(32))]] }]] })),
            'the functions Cells.fresh, which counts new, and Alias.fresh, which counts nothing, are both the import fresh of test:cells, and its names count on bits alike')
    },
    // A module seals a counted type that it defines from bits that hold no address: literals, and integers of 16 bits
    // at most, joined by or and shl, as a short box's tag and units are.
    addressless: () => {
        const cell = sealed('C', 'cell')
        /** `counting` with one more function, `f`, of the parameters `v`, `b`, `c` and `d`. @type {(body: Term) => Module} */
        const plus = body => ({
            ...counting,
            functions: [...counting.functions, ['f', fn([['v', cell], ['b', u(64)], ['c', u(16)], ['d', int(-1n, 0n)], ['w', u(17)]], cell, () => body)]],
        })
        /** `plus`, with only the hooks, in its owned stage. @type {(body: Term) => ReturnType<typeof check>} */
        const owned = body => check({ ...plus(body), functions: [...counting.functions.filter(([k]) => ['tag', 'dup', 'drop'].includes(k)), ...plus(body).functions.slice(-1)], exports: [] })
        const [b, c] = [get('b'), get('c')]
        const box = n(0x7FF0_0000_0000_0018n)
        /** Whether both stages take `f`'s seal. @type {(body: Term) => boolean} */
        const takes = body => checkPlain(plus(body))[0] === 'ok' && owned(body)[0] === 'ok'
        assertEq(takes(seal(cell, box)), true)
        assertEq(takes(seal(cell, or(box, shl(c, n(8n))))), true)
        assertEq(takes(seal(cell, or(or(box, shl(c, n(8n))), shl(c, n(24n))))), true)
        assertEq(takes(seal(cell, or(box, shl(and(shr(b, n(8n)), n(0xFFFFn)), n(8n))))), true)
        assertEq(takes(seal(cell, and(b, n(0xFFFFn)))), true)
        assertEq(takes(seal(cell, c)), true)
        // a wider integer, a negative one, a value's bits and any other op may hold an address
        /** Why the plain stage of `f` is refused. @type {(body: Term) => string} */
        const why = body => assertError(checkPlain(plus(body)))
        const refused = 'f: seal of cell: a counted cell is sealed from a new owner, seal(t, f(…)) or seal(t, or(c, f(…))) where f counts new, or from bits that hold no address, of literals and integers of 16 bits at most joined by or and shl: seal its copy variants, or let the pass copy'
        assertEq(why(seal(cell, get('w'))), refused)
        assertEq(why(seal(cell, get('d'))), refused)
        assertEq(why(seal(cell, b)), refused)
        assertEq(why(seal(cell, or(box, b))), refused)
        assertEq(why(seal(cell, or(box, unseal(get('v'))))), refused)
        assertEq(why(seal(cell, add(c, n(1n)))), refused)
        assertEq(why(seal(cell, xor(box, shl(c, n(8n))))), refused)
        assertEq(assertError(owned(seal(cell, or(box, b)))), refused)
        // the bits are its carrier's, and typed as any are
        assertEq(why(seal(cell, n(-1n))), 'f: seal of int(-1, -1): cell is made of u(64)')
        assertEq(why(seal(cell, get('x'))), 'f: no local x')
    },
    // Only a hook of a counted type that the module defines calls a function that counts on bits, and only as its last term.
    refs: () => {
        assertEq(assertOk(checkPlain(referencing)).functions.map(([k]) => k).join(), 'dup,drop,keep,take,forget,pair')
        /** `referencing` with its functions `fs` in place of those of their names. @type {(fs: Module['functions']) => Module} */
        const with_ = fs => ({ ...referencing, functions: [...referencing.functions.filter(([k]) => !fs.some(([x]) => x === k)), ...fs] })
        const b = get('b')
        /** @type {(name: string, ...args: readonly Term[]) => Term} */
        const r = (name, ...args) => call('Ref', name, args)
        const pw = /** @type {(m: Module) => string} */ (m => assertError(checkPlain(m)))
        assertEq(pw(with_([['f', fn([['b', u(64)]], u(64), () => r('dup_ref', b))]])), 'f: Ref.dup_ref counts a value on its bits, so only the dup of a counted type that the module defines calls it')
        assertEq(pw(with_([['f', fn([['b', u(64)]], unit, () => r('drop_ref', b))]])), 'f: Ref.drop_ref counts a value on its bits, so only the drop of a counted type that the module defines calls it')
        assertEq(pw(with_([['drop', fn([['b', u(64)]], unit, () => let_('c', r('dup_ref', b), () => make([])))]])), 'drop: Ref.dup_ref counts a value on its bits, so only the dup of a counted type that the module defines calls it')
        assertEq(pw({ ...with_([]), constants: [['c', { type: u(64), value: r('dup_ref', n(0n)) }]] }), 'c: Ref.dup_ref counts a value on its bits, so only the dup of a counted type that the module defines calls it')
        // a constant of a hook's name is no hook's body
        assertEq(pw({ ...with_([]), constants: [['dup', { type: u(64), value: r('dup_ref', n(0n)) }]] }), 'dup: Ref.dup_ref counts a value on its bits, so only the dup of a counted type that the module defines calls it')
        assertEq(pw({ ...referencing, defines: { name: 'R', types: [['ref', { variants: ['value'], carrier: 'i64' }]] }, functions: [['dup', fn([['b', u(64)]], u(64), () => r('dup_ref', b))]], exports: [] }),
            'dup: Ref.dup_ref counts a value on its bits, so only the dup of a counted type that the module defines calls it')
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => let_('c', r('dup_ref', b), () => b))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => r('dup_ref', r('dup_ref', b)))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => add(r('dup_ref', b), n(0n)))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['drop', fn([['b', u(64)]], unit, () => let_('c', r('drop_ref', b), () => r('drop_ref', b)))]])), "R.ref's drop calls Ref.drop_ref only as its last term, so at most once on each path")
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => if_(eq(r('dup_ref', b), n(0n)), b, b))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['drop', fn([['b', u(64)]], unit, () => block('out', unit, br('out', r('drop_ref', b))))]])), "R.ref's drop calls Ref.drop_ref only as its last term, so at most once on each path")
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => field(make([['x', r('dup_ref', b)]]), 'x'))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => loop('L', [['x', u(64), r('dup_ref', b)]], x => x))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['dup', fn([['b', u(64)]], u(64), () => loop('L', [['x', u(64), b]], () => r('dup_ref', b)))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        assertEq(pw(with_([['id', fn([['b', u(64)]], u(64), () => b)], ['dup', fn([['b', u(64)]], u(64), () => call_ref(codeOf('id'), [r('dup_ref', b)]))]])), "R.ref's dup answers Ref.dup_ref's result, so it calls Ref.dup_ref only as its last term")
        // a function that counts on bits is dup or drop over one borrowed word of them, and does not fail
        /** `referencing` with Ref's function `name` of signature `s`. @type {(name: string, s: Signature) => Module} */
        const counter = (name, s) => ({ ...referencing, imports: [['Ref', { ...ref[1], functions: [...ref[1].functions.filter(([k]) => k !== name), [name, s]] }]] })
        const miscount = (/** @type {string} */ f) => `Ref: ${f} counts on bits, so it is dup as (b: u(64)) -> u(64) or drop as (b: u(64)) -> unit, over u(64) or u(32), and does not fail`
        assertEq(pw(counter('drop_ref', countsBits('drop', signature([['a', u(64)], ['b', u(64)]], unit)))), miscount('drop_ref'))
        assertEq(pw(counter('drop_ref', countsBits('drop', signature([], unit)))), miscount('drop_ref'))
        assertEq(pw(counter('drop_ref', countsBits('drop', signature([own('b', u(64))], unit)))), 'Ref: b is own, and u(64) is not sealed, so there is nothing to own')
        assertEq(pw(counter('drop_ref', countsBits('drop', signature([['b', f64]], unit)))), miscount('drop_ref'))
        assertEq(pw(counter('drop_ref', countsBits('drop', signature([['b', u(64)]], u(64))))), miscount('drop_ref'))
        assertEq(pw(counter('drop_ref', { ...countsBits('drop', signature([['b', u(64)]], unit)), fails: true })), miscount('drop_ref'))
        assertEq(pw(counter('dup_ref', countsBits('dup', signature([['b', u(64)]], u(32))))), miscount('dup_ref'))
        assertEq(pw(counter('dup_ref', countsBits('dup', signature([], u(64))))), miscount('dup_ref'))
        assertEq(pw(counter('dup_ref', countsBits(/** @type {'dup'} */ (/** @type {unknown} */ ('copy')), signature([['b', u(64)]], u(64))))), miscount('dup_ref'))
        // a host of another ABI may count on u(32) bits, but NaNVM's kind_ref does not count
        const kindCounts = counter('kind_ref', countsBits('dup', signature([['b', u(32)]], u(32))))
        assertOk(checkPlain({ ...kindCounts, imports: kindCounts.imports.map(([k, i]) => [k, { ...i, abi: 'test:ref' }]) }))
        assertEq(pw(kindCounts), "the functions L0's Ref.kind_ref, which counts nothing, and Ref.kind_ref, which counts dup, are both the import kind_ref of fjs:l0, and its names count on bits alike")
        // every name of one host function counts on bits alike
        /** `referencing` with an interface `Alias` of `fjs:l0` that names `dup_ref` by `s`. @type {(s: Signature) => Module} */
        const aliased = s => ({ ...referencing, imports: [...referencing.imports, ['Alias', { abi: 'fjs:l0', types: [], functions: [['dup_ref', s]] }]] })
        const unmarked = "the functions L0's Ref.dup_ref, which counts dup, and Alias.dup_ref, which counts nothing, are both the import dup_ref of fjs:l0, and its names count on bits alike"
        assertEq(pw(aliased(signature([['b', u(64)]], u(64)))), unmarked)
        // alone too: L0's Ref says how NaNVM's functions count, imported or not
        assertEq(pw({ ...aliased(signature([['b', u(64)]], u(64))), imports: [['Alias', { abi: 'fjs:l0', types: [], functions: [['dup_ref', signature([['b', u(64)]], u(64))]] }]] }), unmarked)
        assertOk(checkPlain(aliased(countsBits('dup', signature([['b', u(64)]], u(64))))))
        // a function that is one of NaNVM's own has Ref's signature, as NaNVM's host exports it
        /** A module that imports only `Alias` of `fjs:l0`, naming `name` by `s`. @type {(name: string, s: Signature) => Module} */
        const lone = (name, s) => ({ ...referencing, imports: [['Alias', { abi: 'fjs:l0', types: [], functions: [[name, s]] }]] })
        assertEq(pw(lone('dup_ref', countsBits('dup', signature([['b', u(32)]], u(32))))), "Alias.dup_ref is the import dup_ref of fjs:l0, which L0's Ref.dup_ref declares as (b: u(64)) -> u(64), not (b: u(32)) -> u(32)")
        assertEq(pw(lone('same_ref', signature([['a', u(64)]], bool))), "Alias.same_ref is the import same_ref of fjs:l0, which L0's Ref.same_ref declares as (a: u(64), b: u(64)) -> bool, not (a: u(64)) -> bool")
        assertEq(pw(lone('same_ref', signature([['a', u(64)], ['b', u(32)]], bool))), "Alias.same_ref is the import same_ref of fjs:l0, which L0's Ref.same_ref declares as (a: u(64), b: u(64)) -> bool, not (a: u(64), b: u(32)) -> bool")
        assertEq(pw(lone('kind_ref', signature([['b', u(64)]], int(0n, 9n)))), "Alias.kind_ref is the import kind_ref of fjs:l0, which L0's Ref.kind_ref declares as (b: u(64)) -> int(0, 8), not (b: u(64)) -> int(0, 9)")
        assertEq(pw({ ...referencing, imports: [['Alias', { abi: 'fjs:l0', types: [], constants: [['dup_ref', u(64)]], functions: [] }]] }), "the constant Alias.dup_ref and the function L0's Ref.dup_ref are both the import dup_ref of fjs:l0")
        // other functions of Ref, and its counting ones as the last term of each path, are the hooks' to call
        assertOk(checkPlain(with_([['dup', fn([['b', u(64)]], u(64), () => if_(r('same_ref', b, b), let_('k', r('kind_ref', b), () => if_(true_, r('dup_ref', b), b)), b))]])))
    },
    inline: () => {
        /** A module of functions, `f` first, that exports `f`. @type {(fs: Module['functions']) => Module} */
        const of = fs => ({ imports: [], functions: fs, exports: ['f'] })
        const leaf = fn([['x', f64]], f64, x => add(x, one_))
        /** A function of `x` that calls `g` of it. @type {(g: string) => ReturnType<typeof fn>} */
        const calling = g => fn([['x', f64]], f64, x => call('self', g, [x]))
        // a hint that the pass can keep: a chain of always, an exported one, never, and recursion through a function with no hint
        assertOk(check(of([['f', hint('always', calling('g'))], ['g', hint('always', leaf)], ['h', hint('never', leaf)]])))
        assertOk(check(of([['f', hint('always', calling('g'))], ['g', calling('f')]])))
        // a hint that it cannot
        assertEq(why(of([['f', /** @type {ReturnType<typeof fn>} */ ({ ...leaf, inline: /** @type {never} */ ('often') })]])), 'f: an inline hint is always or never, not often')
        assertEq(why(of([['f', hint('always', calling('f'))]])), 'f is inline always and calls itself through functions inline always, so its copies would never end')
        assertEq(why(of([['f', hint('always', calling('g'))], ['g', hint('always', calling('f'))]])), 'f is inline always and calls itself through functions inline always, so its copies would never end')
        assertEq(why(of([['f', fn([], f64, () => call_ref(codeOf('g'), [one_]))], ['g', hint('always', leaf)]])), 'g is inline always and read as a value, which needs its code')
        assertEq(why({ ...of([['f', leaf], ['g', hint('always', leaf)]]), constants: [['c', { type: code([['borrow', f64]], f64), value: codeOf('g') }]] }), 'g is inline always and read as a value, which needs its code')
        assertEq(why({ ...anyModule, functions: anyModule.functions.map(([k, f]) => [k, k === 'drop' ? hint('always', f) : f]) }), 'drop is inline always and a hook of a type that the module defines, which the lifetime pass and the emitter call')
    },
    br: () => {
        assertEq(why(one([], f64, br('l', one_))), 'f: no label l')
        assertEq(why(one([], f64, return_(y))), 'f: no local y')
        assertEq(why(one([], f64, return_(true_))), 'f: return takes f64, not bool')
        assertEq(why(one([], f64, add(return_(one_), one_))), 'f: a br that gives no value stands where a value is used')
    },
}
