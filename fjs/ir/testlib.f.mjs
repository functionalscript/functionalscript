/**
 * Modules that the proofs under `fjs/ir` share, written by hand in the
 * constructors of [`module.f.mjs`](./module.f.mjs): `samples`, functions
 * of the kind that the first slice is for, among them one for each integer
 * instruction that the emitter writes, and `corners`, the forms that the
 * emitter handles once each. The [host proof](./wasm/proof.mjs) runs
 * both against JavaScript twins.
 *
 * Data only, so no proof of its own: what each module is, is checked
 * wherever it is read.
 *
 * @import { Module, Term } from './types.ts'
 */

import {
    abs, add, block, bool, br, call, div, eq, f64, f64c, false_, float, fn, i, if_, int, le, let_,
    lit, lt, make, match, mul, n, ne, neg, never, not, return_, sqrt, sub, true_, u, variant,
} from './module.f.mjs'

/** `2 ** 40`, beside which `diff`'s operands lie. */
const far = 1n << 40n

/** A float literal, of `f64c` as a literal is. @type {(v: number) => Term} */
const c = v => lit(f64c, v)

/** Functions of the kind that the first slice is for, every one exported. @type {Module} */
export const samples = {
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
