/**
 * Host proofs of the lifetime pass: plain IR, whose owned stage runs on the
 * counting host against a JavaScript twin and leaves every cell as it found
 * it and none over, and the plain stage emitted without the pass, which
 * leaves a cell over. A WebAssembly instance is the boundary: a
 * FunctionalScript proof can neither instantiate a module nor hold the
 * cells that its imports count.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../AGENTS.md#16-use-host-proofs-only-for-documented-host-contracts)).
 *
 * @import { Checked, Module, Param, Term, Type } from '../types.ts'
 * @import { _Value } from '../wasm/types.ts'
 */

import { assert, assertEq, assertOk } from '../../asserts/module.f.js'
import { write } from '../../media/wasm/binary/write/module.f.js'
import { check, checkPlain } from '../check/module.f.js'
import { counting } from '../l0/host/count/module.mjs'
import { any, l0 } from '../l0/module.f.js'
import { add, block, bool, br, call, f64, float, fn, get, if_, let_, lit, loop, lt, match, next, only, own, return_, u } from '../module.f.js'
import { emit } from '../wasm/module.f.js'
import { edges, held, product, run } from '../wasm/testlib.mjs'
import { lifetime } from './module.f.js'

const string = only(any, 'string')

/** A module of plain IR over L0 that exports `f`, with any more functions before it. @type {(params: readonly Param[], result: Type, body: Term, more?: Module['functions']) => Module} */
const module_ = (params, result, body, more = []) => ({
    imports: l0,
    functions: [...more, ['f', fn(params, result, body)]],
    exports: ['f'],
})

/** The owned stage that the pass writes for a module. @type {(m: Module) => Module} */
const owned = m => assertOk(lifetime(m))

/** The string that a value of `any` holds. @type {(v: _Value) => string} */
const text = v => {
    const s = held(v)
    assert(typeof s === 'string', s)
    return s
}

/** A float that a twin gets. @type {(v: _Value) => number} */
const float64 = v => {
    assert(typeof v === 'number', v)
    return v
}

/** `s`, doubled while `i < k`, one more each time. @type {(s: string, i: number, k: number) => string} */
const doubled = (s, i, k) => i < k ? doubled(s + s, i + 1, k) : s

/**
 * `f` of a checked module, called on a counting host of no cells, and the
 * cells alive after it, as text: each handle and its count.
 *
 * @type {(m: Checked, args: readonly unknown[]) => string}
 */
const leftAfter = (m, args) => {
    const bytes = new Uint8Array(write(emit(m)))
    assert(WebAssembly.validate(bytes))
    const h = counting([])
    const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), { 'fjs:l0': h.imports })
    const f = exports.f
    assert(typeof f === 'function')
    f(...args)
    return h.live().map(([k, count]) => `${k}:${count}`).join()
}

/** @type {(a: Term, b: Term) => Term} */
const concat = (a, b) => call('String', 'concat', [a, b])

/** @type {(c: Term) => Term} */
const fromUnit = c => call('String', 'from_unit', [c])

/** @type {(s: Term) => Term} */
const length = s => call('String', 'length', [s])

const a = get('a')
const b = get('b')
const c = get('c')
const k = get('k')
const one = lit(f64, 1)
const zero = lit(f64, 0)

/** Counts of iterations: none, some, a fraction, and ones that no `lt` passes. */
const counts = [0, 1, 2, 3, 2.5, -1, NaN]

export const proof = {
    // A loop that owns its string doubles it, dropping each old one, and gives the last as the result.
    doubles: () => run(
        owned(module_([['a', string], ['k', f64]], string, loop('L', [['s', string, concat(a, a)], ['i', f64, one]], (s, i) =>
            if_(lt(i, k), let_('t', concat(s, s), t => next('L', [['s', t], ['i', add(i, one)]])), s)))),
        { f: ([s, n]) => ({ any: doubled(text(s) + text(s), 1, float64(n)) }) },
        { f: product([edges(string), counts]) }),
    // A path that leaves the function early drops what it owns first.
    early: () => run(
        owned(module_([['a', string], ['b', bool]], f64, let_('t', concat(a, a), t =>
            let_('x', if_(b, return_(zero), one), x => add(x, float(length(t))))))),
        { f: ([s, flag]) => flag === true ? 0 : 1 + 2 * text(s).length },
        {}),
    // A br out of a block drops what the block owns.
    exits: () => run(
        owned(module_([['c', u(16)], ['b', bool]], f64, block('L', f64, let_('s', fromUnit(c), s => if_(b, br('L', zero), float(length(s))))))),
        { f: ([, flag]) => flag === true ? 0 : 1 },
        {}),
    // A use before the last one that takes a local over is a copy, which is dropped too.
    copies: () => run(
        owned(module_([['c', u(16)]], string, let_('s', fromUnit(c), s => let_('t', s, t => concat(s, t))))),
        { f: ([unit]) => ({ any: String.fromCharCode(Number(unit)).repeat(2) }) },
        {}),
    // A parameter that owns its argument gets a copy of a borrow, and drops it after the match that lends it.
    owns: () => run(
        owned(module_([['a', any]], u(31), call('self', 'g', [a]), [['g', fn([own('v', any)], u(31), match(get('v'), [
            [['string'], 's', length(get('s'))],
            [null, null, lit(u(31), 0n)],
        ]))]])),
        { f: ([v]) => {
            const x = held(v)
            return BigInt(typeof x === 'string' ? x.length : 0)
        } },
        {}),
    // An exported function that owns its argument drops it, and its caller keeps a count of its own.
    ownsExported: () => run(
        owned(module_([own('v', any)], u(31), match(get('v'), [[['string'], 's', length(get('s'))], [null, null, lit(u(31), 0n)]]))),
        { f: ([v]) => {
            const x = held(v)
            return BigInt(typeof x === 'string' ? x.length : 0)
        } },
        {}),
    // A br out of a loop to the function's end drops what the loop and the function own.
    out: () => run(
        owned(module_([['c', u(16)], ['k', f64]], f64, let_('s', fromUnit(c), s => loop('L', [['t', string, concat(s, s)], ['i', f64, zero]], (t, i) =>
            if_(lt(i, k), next('L', [['t', t], ['i', add(i, one)]]), return_(float(length(t)))))))),
        { f: () => 2 },
        { f: product([[0x61n], counts]) }),
    // Without the pass, nothing drops the string that from_unit makes; with it, no cell is left.
    leaks: () => {
        const m = module_([['c', u(16)]], u(31), let_('s', fromUnit(c), s => length(s)))
        assertEq(leftAfter(assertOk(checkPlain(m)), [0x61]), '0:1')
        assertEq(leftAfter(assertOk(check(owned(m))), [0x61]), '')
    },
}
