/**
 * What the host proofs of the emitter share: they compile a module of the IR
 * on the host's WebAssembly engine, call every function it exports on the
 * edges of its parameters' types, and compare each answer with a twin's,
 * which computes the same in JavaScript. Inputs that more than one proof
 * reads are here too: the edges of each type, and spellings of indices.
 *
 * The values cross as the WebAssembly JavaScript API passes them: an `i32` as
 * a `number` and an `i64` as a `bigint`, both read as two's complement, so a
 * value of an unsigned range comes back by its bits, and a `bool` as `0` or
 * `1`. A value of `any` is a handle that the [counting
 * host](../l0/host/count/module.mjs) of the `fjs:l0` imports reads, and so
 * does the [host](../native/host/module.f.js) of the `fjs:l1-native`
 * imports: each call has hosts of its own, whose first cells hold the
 * call's values of `any` in the order of the parameters. A parameter that
 * owns its argument gets a `dup` of it, so that the caller keeps its own,
 * and a value of `any` that a call answers is the caller's, so the proof
 * reads it and drops it. A result of `unit` is no value: the JavaScript
 * API gives `undefined`, and the twin answers the same.
 * Where the module has string literals, its start function makes them when
 * the host makes the module, in a memory that holds as many bytes of data
 * segments as its `fjs.layout` asks for, and where it has constants, `init`
 * evaluates them first. The host then keeps every cell alive, what the
 * start function and `init` made among them, since nothing drops a literal
 * or a constant. A call that completes then leaves every cell as it found
 * it, and no other cell, and no builder that it did not seal: a module that
 * keeps or frees a value that it borrows shows, and so does one that leaves
 * a value over. An array that a module makes is the twin's where their
 * items are, one by one.
 *
 * @module
 *
 * @import { Module, Type } from '../types.ts'
 * @import { Counting } from '../l0/host/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Any, _Outcome, _Twin, _Value } from './types.ts'
 */

import { assert, assertNotNullish } from '../../asserts/module.f.js'
import { write } from '../../media/wasm/binary/write/module.f.js'
import { check } from '../check/module.f.js'
import { counting } from '../l0/host/count/module.mjs'
import { fits, isOwn } from '../module.f.js'
import { host as nativeHost } from '../native/host/module.f.js'
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

/**
 * A result of `t`, as the JavaScript API gives it, read back. A value of
 * `any` is a handle that the caller owns: the host reads its value, and the
 * caller drops it. `unit` is no value, so the API gives `undefined`.
 *
 * @type {(t: Type, v: unknown, h: Counting) => _Value}
 */
const fromHost = (t, v, h) => {
    if (t[0] === 'sum') { return v === 1 }
    if (t[0] === 'product') {
        assert(t[1].length === 0, t)
        assert(v === undefined, v)
        return undefined
    }
    if (t[0] === 'sealed') {
        assert(typeof v === 'bigint', v)
        const any = h.read(v)
        h.imports.drop(v)
        return { any }
    }
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

/**
 * Strings for `stringIndex`: the decimal spellings of indices, the greatest
 * and the least past it, leading zeros, signs, spaces, fractions, letters,
 * and digits of other scripts, which spell no index.
 *
 * @type {readonly _Value[]}
 */
export const spellings = [
    '', '0', '7', '00', '01', '10', '42', '4294967295', '4294967296', '99999999999', '12a', 'a1', ' 1', '1 ', '-1', '+1',
    '1.5', '1e3', '\u0663', '/', ':',
].map(v => ({ any: v }))

/** The arrays that values hold, at any depth: those that a call is given. @type {(values: readonly unknown[]) => ReadonlySet<unknown>} */
const arraysIn = values => new Set(values.flatMap(v => Array.isArray(v) ? [v, ...arraysIn(v)] : []))

/**
 * Whether two values that values of `any` hold are the same: by `Object.is`,
 * so that `-0` and `NaN` are told apart, and two arrays item by item, since
 * a module makes an array of its own, unless the twin's is one that the
 * call was given, `given`, which the module must answer itself.
 *
 * @type {(given: ReadonlySet<unknown>) => (a: unknown, b: unknown) => boolean}
 */
const sameHeld = given => (a, b) => Object.is(a, b)
    || Array.isArray(a) && Array.isArray(b) && !given.has(b) && a.length === b.length && a.every((x, k) => sameHeld(given)(x, b[k]))

/** Whether two values are the same: by `Object.is`, and two values of `any` by what they hold. @type {(given: ReadonlySet<unknown>) => (a: _Value, b: _Value) => boolean} */
const same = given => (a, b) => isAny(a) && isAny(b) ? sameHeld(given)(a.any, b.any) : Object.is(a, b)

/** The traps that twins throw: each a token of its own, which no FunctionalScript value is. @type {WeakSet<object>} */
const traps = new WeakSet()

/**
 * A twin's trap, where the module traps with nothing thrown, as an `exact`
 * of a fraction does: a throw of a token that no FunctionalScript value is,
 * which holds the reason for a failed proof to show.
 *
 * @type {(reason: string) => never}
 */
export const trap = reason => {
    const token = { trap: reason }
    traps.add(token)
    throw token
}

/**
 * What a twin answers: a value; a throw of a FunctionalScript value, which
 * the module must throw too; or a trap, which is a `trap` of the twin or a
 * misuse of the L0 view, which throws a reason that starts with `l0.`, as
 * a host's import of it does.
 *
 * @type {(f: () => _Value) => _Outcome}
 */
const expect = f => {
    try {
        return ['ok', f()]
    } catch (e) {
        return typeof e === 'object' && e !== null && traps.has(e) ? ['trapped', e]
            : typeof e === 'string' && e.startsWith('l0.') ? ['trapped', e]
            : ['threw', { any: e }]
    }
}

/**
 * What a call of a module answers: a value; a throw, whose value the host
 * keeps and which `thrown` hands over, the caller reading it and dropping
 * it; or a trap with nothing thrown, and what the engine threw for it.
 *
 * @type {(f: () => _Value, h: Counting) => _Outcome}
 */
const outcome = (f, h) => {
    try {
        return ['ok', f()]
    } catch (e) {
        if (h.has_thrown() === 0) { return ['trapped', e] }
        const t = h.thrown()
        const any = h.read(t)
        h.imports.drop(t)
        return ['threw', { any }]
    }
}

/**
 * Whether a call's outcome is its twin's: the same value, a throw of the
 * same value, or a trap of both, for the same reason where the module's
 * trap was a throw of an import of the view, whose reason is a string.
 *
 * @type {(given: ReadonlySet<unknown>) => (got: _Outcome, expected: _Outcome) => boolean}
 */
const agrees = given => (got, expected) => got[0] === 'trapped'
    ? expected[0] === 'trapped' && (typeof got[1] !== 'string' || got[1] === expected[1])
    : expected[0] !== 'trapped' && got[0] === expected[0] && same(given)(got[1], expected[1])

/** The unsigned LEB128 numbers that `bytes` hold, one after another. @type {(bytes: Uint8Array) => readonly number[]} */
const ulebs = bytes => {
    /** @type {number[]} */
    const out = []
    let n = 0
    let unit = 1
    for (const b of bytes) {
        n += (b % 0x80) * unit
        if (b < 0x80) {
            out.push(n)
            n = 0
            unit = 1
        } else {
            unit *= 0x80
        }
    }
    return out
}

/**
 * The bytes of data segments that a module's `fjs.layout` asks for, `0`
 * where it has none.
 *
 * @type {(m: WebAssembly.Module) => number}
 */
export const dataOf = m => {
    const [section] = WebAssembly.Module.customSections(m, 'fjs.layout')
    return section === undefined ? 0 : ulebs(new Uint8Array(section))[0]
}

/**
 * Checks and emits a module, compiles it on the host's engine, and calls
 * each function that it exports on its inputs, comparing its outcome with
 * its twin's: the same value, a throw of the same value, or a trap of both
 * ([slice 7's choice 6](../todo/slices.md#decisions-for-slice-7-2026-11-15)). A
 * function's inputs are the edges of its parameters' types, unless
 * `inputs` gives them. A function that the checker says cannot fail never
 * fails. After a throw or a trap, the host recovers what the call
 * abandoned, and the cells must then be as the call found them, as after a
 * value: a module that freed what it borrows shows. A throw abandons
 * nothing, since the lifetime pass drops what a function owns before it
 * throws, but where the function's callee throws while it holds a value:
 * `abandons` names the functions that may.
 *
 * @type {(m: Module, twins: StringMap<_Twin>, inputs: StringMap<readonly (readonly _Value[])[]>, abandons?: readonly string[]) => void}
 */
export const run = (m, twins, inputs, abandons = []) => {
    const [tag, checked] = check(m)
    assert(tag === 'ok', checked)
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const compiled = new WebAssembly.Module(bytes)
    const data = dataOf(compiled)
    for (const name of checked.exports) {
        const [, { params, result, fails }] = assertNotNullish(checked.functions.find(([k]) => k === name))
        const twin = assertNotNullish(twins[name], name)
        for (const xs of inputs[name] ?? product(params.map(([, t]) => edges(t)))) {
            const values = xs.flatMap(v => isAny(v) ? [v.any] : [])
            const h = counting(values, data)
            const { exports } = new WebAssembly.Instance(compiled, { 'fjs:l0': h.imports, 'fjs:l1-native': nativeHost(h.read) })
            const { init } = exports
            if (typeof init === 'function') { init() }
            h.keep()
            const f = exports[name]
            assert(typeof f === 'function', name)
            /** @type {(v: _Value, k: number) => unknown} */
            const arg = (v, k) => {
                if (!isAny(v)) { return toHost(params[k][1], v) }
                const handle = BigInt(xs.slice(0, k).filter(isAny).length)
                // a parameter that owns its argument takes a count of its own, and the caller keeps the one it holds
                return isOwn(params[k]) ? h.imports.dup(handle) : handle
            }
            const args = xs.map(arg)
            const got = outcome(() => fromHost(result, f(...args), h), h)
            const expected = expect(() => twin(xs))
            assert(agrees(arraysIn(values))(got, expected), [name, xs, got, expected])
            assert(got[0] === 'ok' || fails, [name, xs, 'cannot fail, and it did'])
            const open = h.builders().map(b => `builder ${b}`)
            const abandoned = got[0] === 'ok' ? [] : [...h.recover().map(([k, count]) => `${k}:+${count}`), ...open]
            assert(got[0] !== 'threw' || abandoned.length === 0 || abandons.includes(name), [name, xs, 'a throw abandoned', abandoned.join()])
            const cells = [...h.live().map(([k, count]) => `${k}:${count}`), ...(got[0] === 'ok' ? open : [])].join()
            assert(cells === '', [name, xs, cells])
        }
    }
}
