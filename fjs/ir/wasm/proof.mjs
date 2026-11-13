/**
 * Host proofs of the emitter: what only a WebAssembly engine can settle.
 *
 * [`proof.f.mjs`](./proof.f.mjs) holds the WAT that the emitter writes.
 * Whether that is a module an engine accepts, and whether it computes what
 * the IR means, needs an engine, and FunctionalScript runs no WebAssembly.
 * So each module of [`testlib.f.mjs`](../testlib.f.mjs) is compiled here by
 * the host's engine, and every function it exports is called on the edges of
 * its parameters' types and compared with a JavaScript twin, which computes
 * the same in exact integers and IEEE doubles.
 *
 * The values cross as the WebAssembly JavaScript API passes them: an `i32` as
 * a `number` and an `i64` as a `bigint`, both read as two's complement, so a
 * value of an unsigned range comes back by its bits, and a `bool` as `0` or
 * `1`.
 *
 * @import { Module, Type } from '../types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Twin, _Value } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { write } from '../../media/wasm/binary/write/module.f.mjs'
import { check } from '../check/module.f.mjs'
import { fits } from '../module.f.js'
import { corners, samples } from '../testlib.f.mjs'
import { emit } from './module.f.js'

// values

/** @type {(v: _Value) => bigint} */
const int = v => (assert(typeof v === 'bigint', v), v)

/** @type {(v: _Value) => number} */
const num = v => (assert(typeof v === 'number', v), v)

/** @type {(v: _Value) => boolean} */
const bit = v => (assert(typeof v === 'boolean', v), v)

/** A value as the JavaScript API takes it for a parameter of `t`. @type {(t: Type, v: _Value) => unknown} */
const toHost = (t, v) =>
    typeof v === 'boolean' ? (v ? 1 : 0)
    : typeof v === 'bigint' ? (t[0] === 'int' && fits(32)(t) ? Number(BigInt.asIntN(32, v)) : BigInt.asIntN(64, v))
    : v

/** A result of `t`, as the JavaScript API gives it, read back. @type {(t: Type, v: unknown) => _Value} */
const fromHost = (t, v) => {
    if (t[0] === 'sum') { return v === 1 }
    if (t[0] !== 'int') {
        assert(typeof v === 'number', v)
        return v
    }
    const unsigned = t[1] >= 0n
    if (fits(32)(t)) {
        assert(typeof v === 'number', v)
        return unsigned ? BigInt(v >>> 0) : BigInt(v)
    }
    assert(typeof v === 'bigint', v)
    return unsigned ? BigInt.asUintN(64, v) : v
}

/** The edges of a type: the ends of a range and the words' boundaries in it, and floats of every kind. @type {(t: Type) => readonly _Value[]} */
const edges = t => {
    if (t[0] === 'int') {
        const [, lo, hi] = t
        const marks = [lo, lo + 1n, -1n, 0n, 1n, 0x7fff_ffffn, 0x8000_0000n, 0xffff_ffffn, (1n << 63n) - 1n, 1n << 63n, hi - 1n, hi]
        return [...new Set(marks)].filter(v => lo <= v && v <= hi)
    }
    return t[0] === 'sum' ? [false, true] : [0, -0, 1, -1.5, 2.5, 1e308, -1e308, 5e-324, Infinity, -Infinity, NaN]
}

/** Every list of one value of each list, in order. @type {(lists: readonly (readonly _Value[])[]) => readonly (readonly _Value[])[]} */
const product = lists => lists.reduce(
    /** @type {(done: readonly (readonly _Value[])[], list: readonly _Value[]) => readonly (readonly _Value[])[]} */
    (done, list) => done.flatMap(xs => list.map(v => [...xs, v])),
    [[]])

// twins

/** @type {(x: number, k: number) => number} */
const pow = (x, k) => k <= 0 ? 1 : x * pow(x, k - 1)

/** @type {(a: number, b: number) => number} */
const hypot = (a, b) => Math.sqrt(a * a + b * b)

/** What each exported function computes, on the same arguments. @type {StringMap<_Twin>} */
const twins = {
    max: ([a, b]) => num(a) < num(b) ? b : a,
    sum: ([a, b]) => int(a) + int(b),
    sign: ([x]) => int(x) < 0n ? -1n : x === 0n ? 0n : 1n,
    clamp: ([x, lo, hi]) => int(x) < int(lo) ? lo : int(hi) < int(x) ? hi : x,
    area: ([w, h]) => int(w) * int(h),
    diff: ([a, b]) => int(a) - int(b),
    double: ([a]) => int(a) + int(a),
    delta: ([a, b]) => int(a) - int(b),
    product: ([a, b]) => int(a) * int(b),
    same: ([a, b]) => int(a) === int(b),
    lessU32: ([a, b]) => int(a) < int(b),
    lessMixed: ([a, b]) => int(a) < int(b),
    lessU64: ([a, b]) => int(a) < int(b),
    atMost: ([a, b]) => int(a) <= int(b),
    atMostU32: ([a, b]) => int(a) <= int(b),
    atMostI64: ([a, b]) => int(a) <= int(b),
    atMostU64: ([a, b]) => int(a) <= int(b),
    notEqual: ([a, b]) => int(a) !== int(b),
    toFloat: ([a]) => Number(int(a)),
    toFloatSigned: ([a]) => Number(int(a)),
    toFloatWide: ([a]) => Number(int(a)),
    average: ([a, b]) => Number(int(a) + int(b)) / 2,
    magnitude: ([x]) => Math.abs(-num(x)),
    hypot: ([a, b]) => hypot(num(a), num(b)),
    distance: ([x, y, p, q]) => hypot(num(p) - num(x), num(q) - num(y)),
    safeDiv: ([a, b]) => num(b) === 0 ? 0 : num(a) / num(b),
    pow: ([x, k]) => pow(num(x), num(k)),
    pick: ([a, b]) => (0 < num(a) ? num(a) : 0 < num(b) ? num(b) : 0) + 1,
    xor: ([a, b]) => bit(a) ? !bit(b) : b,
    topU32: () => 0xffff_ffffn,
    topU64: () => 0xffff_ffff_ffff_ffffn,
    bottomI64: () => -(1n << 63n),
    wide: ([x]) => bit(x) ? 1n : 1n << 40n,
    unitLocal: () => true,
    oneArm: () => 1,
    falseFirst: ([a]) => bit(a) ? 1 : 0,
    neverBlock: ([x]) => x,
    neverIf: ([a]) => bit(a) ? 1 : 2,
    guarded: ([, x]) => x,
    twice: ([a]) => a,
}

/**
 * The arguments of the functions that the edges do not suit: `pow` recurses
 * `k` times, and `guarded` never returns where its `a` is `true`.
 *
 * @type {StringMap<readonly (readonly _Value[])[]>}
 */
const inputs = {
    pow: product([edges(['f64']), [0, -0, 1, 2, 10, -1, 0.5, 3.5]]),
    guarded: product([[false], edges(['f64'])]),
}

/**
 * Compiles a module on the host's engine, and calls each function that it
 * exports on its inputs, comparing it with its twin: `Object.is`, so that
 * `-0` and `NaN` are told apart.
 *
 * @type {(m: Module) => void}
 */
const run = m => {
    const [tag, checked] = check(m)
    assert(tag === 'ok', checked)
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes))
    for (const name of checked.exports) {
        const [, { params, result }] = assertNotNullish(checked.functions.find(([k]) => k === name))
        const f = exports[name]
        assert(typeof f === 'function', name)
        const twin = assertNotNullish(twins[name], name)
        for (const xs of inputs[name] ?? product(params.map(([, t]) => edges(t)))) {
            const got = fromHost(result, f(...xs.map((v, k) => toHost(params[k][1], v))))
            const expected = twin(xs)
            assert(Object.is(got, expected), [name, xs, got, expected])
        }
    }
}

export const proof = {
    samples: () => run(samples),
    corners: () => run(corners),
}
