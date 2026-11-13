/**
 * Modules that the proofs under `fjs/ir` share, written by hand in the
 * constructors of [`module.f.mjs`](./module.f.mjs): `samples`, functions
 * of the kind that the first slice is for, among them one for each integer
 * instruction that the emitter writes, `corners`, the forms that the
 * emitter handles once each, `unknown`, functions over values of unknown
 * kind, as the third slice reads them, and `loops`, the fourth slice's.
 * The [host proof](./wasm/proof.mjs) runs them all against JavaScript
 * twins.
 *
 * Data only, so no proof of its own: what each module is, is checked
 * wherever it is read.
 *
 * @import { Module, Term } from './types.ts'
 */

import { any, l0 } from './l0/module.f.mjs'
import {
    abs, add, block, bool, br, call, cast, div, eq, exact, f64, f64c, false_, float, fn, get, i, if_, int, le, let_,
    lit, loop, lt, make, match, mul, n, ne, neg, never, next, not, only, return_, sqrt, sub, trap, true_, trunc_sat,
    u, variant,
} from './module.f.mjs'

/** `2 ** 40`, beside which `diff`'s operands lie. */
const far = 1n << 40n

/** A float literal, of `f64c` as a literal is. @type {(v: number) => Term} */
const c = v => lit(f64c, v)

/** Functions of the kind that the first slice is for, every one exported. @type {Module} */
export const samples = {
    imports: [],
    functions: [
        ['max', fn([['a', f64], ['b', f64]], f64, (a, b) => if_(lt(a, b), b, a))],
        ['sum', fn([['a', u(32)], ['b', u(32)]], int(0n, 0x1_ffff_fffen), (a, b) => add(a, b))],
        ['sign', fn([['x', i(64)]], int(-1n, 1n), x => if_(lt(x, n(0n)), n(-1n), if_(eq(x, n(0n)), n(0n), n(1n))))],
        ['clamp', fn([['x', i(32)], ['lo', i(32)], ['hi', i(32)]], i(32), (x, lo, hi) => if_(lt(x, lo), lo, if_(lt(hi, x), hi, x)))],
        ['area', fn([['w', i(16)], ['h', i(16)]], i(32), (w, h) => mul(w, h))],
        ['diff', fn([['a', int(far, far + 10n)], ['b', int(far, far + 10n)]], int(-10n, 10n), (a, b) => sub(a, b))],
        ['double', fn([['a', u(31)]], u(32), a => add(a, a))],
        ['delta', fn([['a', i(16)], ['b', i(16)]], i(32), (a, b) => sub(a, b))],
        ['product', fn([['a', u(32)], ['b', u(32)]], u(64), (a, b) => mul(a, b))],
        ['same', fn([['a', u(32)], ['b', u(32)]], bool, (a, b) => eq(a, b))],
        ['lessU32', fn([['a', u(32)], ['b', u(32)]], bool, (a, b) => lt(a, b))],
        ['lessMixed', fn([['a', u(32)], ['b', i(32)]], bool, (a, b) => lt(a, b))],
        ['lessU64', fn([['a', u(64)], ['b', u(64)]], bool, (a, b) => lt(a, b))],
        ['atMost', fn([['a', i(32)], ['b', i(32)]], bool, (a, b) => le(a, b))],
        ['atMostU32', fn([['a', u(32)], ['b', u(32)]], bool, (a, b) => le(a, b))],
        ['atMostI64', fn([['a', i(64)], ['b', i(64)]], bool, (a, b) => le(a, b))],
        ['atMostU64', fn([['a', u(64)], ['b', u(64)]], bool, (a, b) => le(a, b))],
        ['notEqual', fn([['a', i(64)], ['b', u(32)]], bool, (a, b) => ne(a, b))],
        ['toFloat', fn([['a', u(32)]], f64, a => float(a))],
        ['toFloatSigned', fn([['a', i(32)]], f64, a => float(a))],
        ['toFloatWide', fn([['a', u(53)]], f64, a => float(a))],
        ['average', fn([['a', i(32)], ['b', i(32)]], f64, (a, b) => div(float(add(a, b)), c(2)))],
        ['magnitude', fn([['x', f64]], f64, x => abs(neg(x)))],
        ['hypot', fn([['a', f64], ['b', f64]], f64, (a, b) => sqrt(add(mul(a, a), mul(b, b))))],
        ['distance', fn([['x', f64], ['y', f64], ['p', f64], ['q', f64]], f64, (x, y, p, q) =>
            call('self', 'hypot', [sub(p, x), sub(q, y)]))],
        ['safeDiv', fn([['a', f64], ['b', f64]], f64, (a, b) => if_(eq(b, c(0)), return_(c(0)), div(a, b)))],
        ['pow', fn([['x', f64], ['k', f64]], f64, (x, k) =>
            if_(le(k, c(0)), c(1), mul(x, call('self', 'pow', [x, sub(k, c(1))]))))],
        ['pick', fn([['a', f64], ['b', f64]], f64, (a, b) => let_('x', block('found', f64,
            let_('y', if_(lt(c(0), a), br('found', a), b), y => if_(lt(c(0), y), y, c(0)))), x => add(x, c(1))))],
        ['xor', fn([['a', bool], ['b', bool]], bool, (a, b) => if_(a, not(b), b))],
    ],
    exports: [
        'max', 'sum', 'sign', 'clamp', 'area', 'diff', 'double', 'delta', 'product', 'same', 'lessU32',
        'lessMixed', 'lessU64', 'atMost', 'atMostU32', 'atMostI64', 'atMostU64', 'notEqual', 'toFloat',
        'toFloatSigned', 'toFloatWide', 'average', 'magnitude', 'hypot', 'distance', 'safeDiv', 'pow',
        'pick', 'xor',
    ],
}

/**
 * The forms that the samples leave out: words at their ends, a local of
 * `unit`, a `match` of one arm and one with `false` first, the three terms
 * of type `never` that WASM does not know end, a literal widened where it
 * is returned, and `let`s whose locals the name section names twice.
 *
 * @type {Module}
 */
export const corners = {
    imports: [],
    functions: [
        ['topU32', fn([], u(32), lit(u(32), 0xffff_ffffn))],
        ['topU64', fn([], u(64), lit(u(64), 0xffff_ffff_ffff_ffffn))],
        ['bottomI64', fn([], i(64), lit(i(64), -(1n << 63n)))],
        ['wide', fn([['x', bool]], u(64), x => if_(x, n(1n), lit(u(64), 1n << 40n)))],
        ['unitLocal', fn([['a', bool]], bool, () => let_('nothing', make([]), x => variant(bool, 'true', x)))],
        ['oneArm', fn([['a', bool]], f64, a => match(a, [[null, null, c(1)]]))],
        ['falseFirst', fn([['a', bool]], f64, a => match(a, [[['false'], null, c(0)], [['true'], null, c(1)]]))],
        ['neverBlock', fn([['x', f64]], f64, x => block('out', never, return_(x)))],
        ['neverIf', fn([['a', bool]], f64, a => if_(a, return_(c(1)), return_(c(2))))],
        ['spin', fn([['x', f64]], never, x => call('self', 'spin', [x]))],
        ['guarded', fn([['a', bool], ['x', f64]], f64, (a, x) => if_(a, call('self', 'spin', [x]), x))],
        ['twice', fn([['a', bool]], bool, a =>
            if_(a, let_('t', true_, t => t), let_('t', false_, t => t)))],
    ],
    exports: ['topU32', 'topU64', 'bottomI64', 'wide', 'unitLocal', 'oneArm', 'falseFirst', 'neverBlock', 'neverIf', 'guarded', 'twice'],
}

/** A call of an L0 function, by its interface and its name. @type {(module: string, name: string) => (...args: readonly Term[]) => Term} */
const l0Call = (module, name) => (...args) => call(module, name, args)

const kindOf = l0Call('Any', 'kind')

const toF64 = l0Call('Any', 'to_f64')

/** The `length` of an L0 module. @type {(module: string) => (...args: readonly Term[]) => Term} */
const lengthOf = module => l0Call(module, 'length')

/**
 * Functions over values of unknown kind, each parameter borrowed: L1's
 * `toBoolean`, as one `match` of its operand, and the forms that the
 * emitter writes once each for a `match` of `any`: the tag read where the
 * one arm that is tested tests it, and into a local where more arms are;
 * an operand that is no local; one arm alone; a cast; a `match` whose
 * every arm traps; and a call that lends `any` on.
 *
 * @type {Module}
 */
export const unknown = {
    imports: l0,
    functions: [
        ['toBoolean', fn([['v', any]], bool, v => match(v, [
            [['boolean'], 'b', l0Call('Any', 'to_bool')(get('b'))],
            [['number'], 'x', let_('f', toF64(get('x')), f => if_(eq(f, f), ne(f, c(0)), false_))],
            [['string'], 's', ne(lengthOf('String')(get('s')), n(0n))],
            [['bigint'], 'g', ne(lengthOf('BigInt')(get('g')), n(0n))],
            [['array', 'object', 'function'], null, true_],
            [null, null, false_],
        ]))],
        ['kindOf', fn([['v', any]], int(0n, 8n), v => kindOf(v))],
        ['isNumber', fn([['v', any]], bool, v => match(v, [[['number'], null, true_], [null, null, false_]]))],
        ['size', fn([['v', any]], u(31), v => match(let_('w', v, w => w), [
            [['string'], 's', lengthOf('String')(get('s'))],
            [['array', 'object'], 'c', lengthOf('Containers')(get('c'))],
            [['function'], 'f', lengthOf('Functions')(get('f'))],
            [null, null, n(0n)],
        ]))],
        ['tag', fn([['v', any]], int(0n, 8n), v => match(v, [[null, 'x', kindOf(get('x'))]]))],
        ['number', fn([['v', any]], f64c, v => cast(only(any, 'number'), v, 'x', toF64))],
        ['fail', fn([['v', any]], f64, v => match(v, [[['number'], null, trap('a number')], [null, null, trap('no number')]]))],
        ['falsy', fn([['v', any]], bool, v => not(call('self', 'toBoolean', [v])))],
    ],
    exports: ['toBoolean', 'kindOf', 'isNumber', 'size', 'tag', 'number', 'fail', 'falsy'],
}

/** A string. */
const string = only(any, 'string')

/** String's `unit` of `s` at the index that the float `i` holds exactly, which is bound to `name`. @type {(s: Term, i: Term, name: string) => Term} */
const unitAt = (s, i, name) => exact(u(31), i, name, k => call('String', 'unit', [s, k]))

/**
 * Loops: L1's `stringEquals` and `stringLess` by hand, each counter a float
 * as FAST has it, read as an index through `exact`, and the forms that the
 * emitter writes once each for a loop: two parameters, which a `br` sets at
 * once, a loop in a loop that repeats the outer one, a parameter of `any`,
 * `exact` of a term and of a literal, and `trunc_sat` to each kind of word
 * and bound.
 *
 * @type {Module}
 */
export const loops = {
    imports: l0,
    functions: [
        ['stringEquals', fn([['a', any], ['b', any]], bool, (a, b) =>
            cast(string, a, 'a.string', sa =>
            let_('n', float(lengthOf('String')(sa)), length =>
            cast(string, b, 'b.string', sb =>
            if_(eq(length, float(lengthOf('String')(sb))),
                loop('L', [['i', f64, c(0)]], i =>
                    if_(lt(i, length),
                        if_(eq(unitAt(sa, i, 'i.a'), unitAt(sb, i, 'i.b')), next('L', [['i', add(i, c(1))]]), false_),
                        true_)),
                false_)))))],
        ['stringLess', fn([['a', any], ['b', any]], bool, (a, b) =>
            cast(string, a, 'a.string', sa =>
            let_('na', float(lengthOf('String')(sa)), na =>
            cast(string, b, 'b.string', sb =>
            let_('nb', float(lengthOf('String')(sb)), nb =>
            loop('L', [['i', f64, c(0)]], i =>
                if_(lt(i, na),
                    if_(lt(i, nb),
                        let_('x', unitAt(sa, i, 'i.a'), x =>
                        let_('y', unitAt(sb, i, 'i.b'), y =>
                        if_(eq(x, y), next('L', [['i', add(i, c(1))]]), lt(x, y)))),
                        false_),
                    lt(na, nb))))))))],
        ['factorial', fn([['x', f64]], f64, x =>
            loop('L', [['k', f64, x], ['acc', f64, c(1)]], (k, acc) =>
                if_(lt(c(0), k), next('L', [['k', sub(k, c(1))], ['acc', mul(acc, k)]]), acc)))],
        ['triangle', fn([['x', f64]], f64, x =>
            loop('Outer', [['i', f64, c(0)], ['s', f64, c(0)]], (i, s) =>
                if_(lt(i, x),
                    loop('Inner', [['j', f64, c(0)], ['t', f64, s]], (j, t) =>
                        if_(lt(j, i), next('Inner', [['j', add(j, c(1))], ['t', add(t, c(1))]]), next('Outer', [['i', add(i, c(1))], ['s', t]]))),
                    s)))],
        ['kindAfter', fn([['v', any], ['x', f64]], int(0n, 8n), (v, x) =>
            loop('L', [['w', any, v], ['k', f64, x]], (w, k) =>
                if_(lt(c(0), k), next('L', [['w', w], ['k', sub(k, c(1))]]), kindOf(w))))],
        ['index', fn([['x', f64]], u(31), x => exact(u(31), x, 'k', k => k))],
        ['indexOfSum', fn([['x', f64]], u(31), x => exact(u(31), add(x, c(1)), 'k', k => k))],
        ['three', fn([], u(31), () => exact(u(31), c(3), 'k', k => k))],
        ['toU31', fn([['x', f64]], u(31), x => trunc_sat(u(31), x))],
        ['toI32', fn([['x', f64]], i(32), x => trunc_sat(i(32), x))],
        ['toU32', fn([['x', f64]], u(32), x => trunc_sat(u(32), x))],
        ['toSmall', fn([['x', f64]], int(-5n, 300n), x => trunc_sat(int(-5n, 300n), x))],
        ['toU64', fn([['x', f64]], u(64), x => trunc_sat(u(64), x))],
        ['toI64', fn([['x', f64]], i(64), x => trunc_sat(i(64), x))],
        ['toWide', fn([['x', f64]], int(10n, 1n << 40n), x => trunc_sat(int(10n, 1n << 40n), x))],
        ['toNegative', fn([['x', f64]], int(-(1n << 40n), -3n), x => trunc_sat(int(-(1n << 40n), -3n), x))],
    ],
    exports: [
        'stringEquals', 'stringLess', 'factorial', 'triangle', 'kindAfter', 'index', 'indexOfSum', 'three',
        'toU31', 'toI32', 'toU32', 'toSmall', 'toU64', 'toI64', 'toWide', 'toNegative',
    ],
}
