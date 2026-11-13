/**
 * What the host proofs of the emitter share: they compile a module of the IR
 * on the host's WebAssembly engine, call every function it exports on the
 * edges of its parameters' types, and compare each answer with a twin's,
 * which computes the same in JavaScript.
 *
 * The values cross as the WebAssembly JavaScript API passes them: an `i32` as
 * a `number` and an `i64` as a `bigint`, both read as two's complement, so a
 * value of an unsigned range comes back by its bits, and a `bool` as `0` or
 * `1`.
 *
 * @module
 *
 * @import { Module, Type } from '../types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Twin, _Value } from './private.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { write } from '../../media/wasm/binary/write/module.f.mjs'
import { check } from '../check/module.f.mjs'
import { fits } from '../module.f.mjs'
import { emit } from './module.f.mjs'

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
export const edges = t => {
    if (t[0] === 'int') {
        const [, lo, hi] = t
        const marks = [lo, lo + 1n, -1n, 0n, 1n, 0x7fff_ffffn, 0x8000_0000n, 0xffff_ffffn, (1n << 63n) - 1n, 1n << 63n, hi - 1n, hi]
        return [...new Set(marks)].filter(v => lo <= v && v <= hi)
    }
    return t[0] === 'sum' ? [false, true] : [0, -0, 1, -1.5, 2.5, 1e308, -1e308, 5e-324, Infinity, -Infinity, NaN]
}

/** Every list of one value of each list, in order. @type {(lists: readonly (readonly _Value[])[]) => readonly (readonly _Value[])[]} */
export const product = lists => lists.reduce(
    /** @type {(done: readonly (readonly _Value[])[], list: readonly _Value[]) => readonly (readonly _Value[])[]} */
    (done, list) => done.flatMap(xs => list.map(v => [...xs, v])),
    [[]])

/**
 * Checks and emits a module, compiles it on the host's engine, and calls
 * each function that it exports on its inputs, comparing it with its twin:
 * `Object.is`, so that `-0` and `NaN` are told apart. A function's inputs
 * are the edges of its parameters' types, unless `inputs` gives them.
 *
 * @type {(m: Module, twins: StringMap<_Twin>, inputs: StringMap<readonly (readonly _Value[])[]>) => void}
 */
export const run = (m, twins, inputs) => {
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
