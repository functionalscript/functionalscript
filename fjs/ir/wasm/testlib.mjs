/**
 * What the host proofs of the emitter share: they compile a module of the IR
 * on the host's WebAssembly engine, call every function it exports on the
 * edges of its parameters' types, and compare each answer with a twin's,
 * which computes the same in JavaScript.
 *
 * The values cross as the WebAssembly JavaScript API passes them: an `i32` as
 * a `number` and an `i64` as a `bigint`, both read as two's complement, so a
 * value of an unsigned range comes back by its bits, and a `bool` as `0` or
 * `1`. A value of `any` is a handle that the [host](../l0/host/module.f.js)
 * of the `fjs:l0` imports reads: each call has a host of its own, whose
 * table holds the call's values of `any` in the order of the parameters.
 *
 * @module
 *
 * @import { Module, Type } from '../types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Any, _Twin, _Value } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { write } from '../../media/wasm/binary/write/module.f.mjs'
import { check } from '../check/module.f.mjs'
import { host } from '../l0/host/module.f.js'
import { fits } from '../module.f.js'
import { emit } from './module.f.js'

/** @type {(v: _Value) => v is _Any} */
const isAny = v => typeof v === 'object'

/** The FunctionalScript value that a value of `any` holds, for a twin. @type {(v: _Value) => unknown} */
export const held = v => {
    assert(isAny(v), v)
    return v.any
}

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

/** The floats at the edges: both zeros, the extremes, the least subnormal, the infinities and NaN. */
const floats = [0, -0, 1, -1.5, 2.5, 1e308, -1e308, 5e-324, Infinity, -Infinity, NaN]

/**
 * The values of each kind of `any` that a proof passes: the falsy ones, the
 * empty and a full container, a bigint past one word, and functions of no
 * parameter and of two.
 *
 * @type {StringMap<readonly unknown[]>}
 */
const kinds = {
    undefined: [undefined],
    null: [null],
    boolean: [false, true],
    number: floats,
    string: ['', 'a', 'ab'],
    bigint: [0n, 1n, -1n, 1n << 64n],
    array: [[], [0], [undefined, undefined]],
    object: [{}, { a: 1 }],
    function: [() => 0, (/** @type {unknown} */ a, /** @type {unknown} */ b) => [a, b]],
}

/**
 * The edges of a type: the ends of a range and the words' boundaries in it,
 * floats of every kind, and the values of each kind that a value of `any`
 * may have.
 *
 * @type {(t: Type) => readonly _Value[]}
 */
export const edges = t => {
    if (t[0] === 'int') {
        const [, lo, hi] = t
        const marks = [lo, lo + 1n, -1n, 0n, 1n, 0x7fff_ffffn, 0x8000_0000n, 0xffff_ffffn, (1n << 63n) - 1n, 1n << 63n, hi - 1n, hi]
        return [...new Set(marks)].filter(v => lo <= v && v <= hi)
    }
    if (t[0] === 'sealed') {
        assert(t[1] === 'Any' && t[2] === 'any', t)
        return (t[3] ?? Object.keys(kinds)).flatMap(k => assertNotNullish(kinds[k], k).map(any => ({ any })))
    }
    return t[0] === 'sum' ? [false, true] : floats
}

/** Every list of one value of each list, in order. @type {(lists: readonly (readonly _Value[])[]) => readonly (readonly _Value[])[]} */
export const product = lists => lists.reduce(
    /** @type {(done: readonly (readonly _Value[])[], list: readonly _Value[]) => readonly (readonly _Value[])[]} */
    (done, list) => done.flatMap(xs => list.map(v => [...xs, v])),
    [[]])

/** What a call answers, or that it threw. @type {(f: () => _Value) => readonly ['ok', _Value] | readonly ['threw']} */
const attempt = f => {
    try {
        return ['ok', f()]
    } catch {
        return ['threw']
    }
}

/**
 * Checks and emits a module, compiles it on the host's engine, and calls
 * each function that it exports on its inputs, comparing it with its twin:
 * `Object.is`, so that `-0` and `NaN` are told apart, and where the twin
 * throws, the call must fail too, by a trap or by a throw of the host. A
 * function's inputs are the edges of its parameters' types, unless `inputs`
 * gives them.
 *
 * @type {(m: Module, twins: StringMap<_Twin>, inputs: StringMap<readonly (readonly _Value[])[]>) => void}
 */
export const run = (m, twins, inputs) => {
    const [tag, checked] = check(m)
    assert(tag === 'ok', checked)
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const compiled = new WebAssembly.Module(bytes)
    for (const name of checked.exports) {
        const [, { params, result }] = assertNotNullish(checked.functions.find(([k]) => k === name))
        const twin = assertNotNullish(twins[name], name)
        for (const xs of inputs[name] ?? product(params.map(([, t]) => edges(t)))) {
            const values = xs.flatMap(v => isAny(v) ? [v.any] : [])
            const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': host(values) })
            const f = exports[name]
            assert(typeof f === 'function', name)
            const args = xs.map((v, k) => isAny(v) ? BigInt(xs.slice(0, k).filter(isAny).length) : toHost(params[k][1], v))
            const got = attempt(() => fromHost(result, f(...args)))
            const expected = attempt(() => twin(xs))
            const same = got[0] === 'threw' ? expected[0] === 'threw' : expected[0] === 'ok' && Object.is(got[1], expected[1])
            assert(same, [name, xs, got, expected])
        }
    }
}
