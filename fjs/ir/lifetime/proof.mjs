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
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { _Twin, _Value } from '../wasm/types.ts'
 */

import { assert, assertEq, assertOk } from '../../asserts/module.f.js'
import { write } from '../../media/wasm/binary/write/module.f.js'
import { check, checkPlain } from '../check/module.f.js'
import { counting } from '../l0/host/count/module.mjs'
import { kind, unit } from '../../wasm/runtime/l0/module.f.js'
import { any, l0 } from '../l0/module.f.js'
import { add, block, bool, br, call, f64, float, fn, get, if_, let_, lit, loop, lt, match, next, only, own, return_, throw_, u } from '../module.f.js'
import { throws } from '../testlib.f.mjs'
import { emit } from '../wasm/module.f.js'
import { edges, held, product, run, trap } from '../wasm/testlib.mjs'
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

/** `s`, doubled while it is shorter than `k`. @type {(s: string, k: number) => string} */
const grown = (s, k) => s.length < k ? grown(s + s, k) : s

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

/** The string that a value of `any` holds, and a throw of `why` where it holds another kind. @type {(v: _Value, why: string) => string} */
const textOr = (v, why) => {
    const x = held(v)
    if (typeof x !== 'string') { throw why }
    return x
}

/** The twins of `throws`, which throw where it throws, and trap where the L0 view throws. @type {StringMap<_Twin>} */
const throwing = {
    ownedLength: ([v]) => BigInt(textOr(v, 'not a string').length),
    rethrow: ([v]) => { throw held(v) },
    doubled: ([a, b]) => {
        const x = textOr(a, 'a')
        textOr(b, 'b')
        return { any: x + x }
    },
    checked: ([v]) => BigInt(textOr(v, 'not a string').length),
    viaCallee: ([a, v]) => BigInt(2 * text(a).length + textOr(v, 'not a string').length),
    unitOf: ([s, i]) => BigInt(unit(text(s), Number(i))),
    kindOf: ([v]) => BigInt(kind(held(v))),
}

/** What `run` refused with, or `null` where it took every call. @type {(f: () => void) => unknown} */
const refusal = f => {
    try {
        f()
    } catch (e) {
        return e
    }
    return null
}

/** Whether `run` refused a call of `name` for disagreeing with its twin. @type {(name: string, f: () => void) => boolean} */
const disagrees = (name, f) => {
    const e = refusal(f)
    return Array.isArray(e) && e[0] === name && e.length === 4 && Array.isArray(e[2])
}

/** Whether `run` refused a call of `name` for `why`. @type {(name: string, why: string, f: () => void) => boolean} */
const refusedFor = (name, why, f) => {
    const e = refusal(f)
    return Array.isArray(e) && e[0] === name && e[2] === why
}

export const proof = {
    // A loop that owns its string doubles it, dropping each old one, and gives the last as the result.
    doubles: () => run(
        owned(module_([['a', string], ['k', f64]], string, loop('L', [['s', string, concat(a, a)], ['i', f64, one]], (s, i) =>
            if_(lt(i, k), let_('t', concat(s, s), t => next('L', [['s', t], ['i', add(i, one)]])), s)))),
        { f: ([s, n]) => ({ any: doubled(text(s) + text(s), 1, float64(n)) }) },
        { f: product([edges(string), counts]) }),
    // A loop whose condition reads the string that it owns gives that string as its value, moved.
    grows: () => run(
        owned(module_([['c', u(16)], ['k', f64]], string, loop('L', [['s', string, fromUnit(c)]], s =>
            if_(lt(float(length(s)), k), next('L', [['s', concat(s, s)]]), s)))),
        { f: ([unit, n]) => ({ any: grown(String.fromCharCode(Number(unit)), float64(n)) }) },
        { f: product([[0x61n], counts]) }),
    // A path that leaves the function early drops what it owns first.
    early: () => run(
        owned(module_([['a', string], ['b', bool]], f64, let_('t', concat(a, a), t =>
            let_('x', if_(b, return_(zero), one), x => add(x, float(length(t))))))),
        { f: ([s, flag]) => flag === true ? 0 : 1 + 2 * text(s).length },
        {}),
    // A part that may leave by a br leaves nothing over: what the parts before it gave is dropped where it leaves,
    // and taken over by the call or the loop where it does not.
    leaving: () => run(
        owned(module_([['c', u(16)], ['b', bool]], f64, call('self', 'g', [fromUnit(c), if_(b, return_(zero), fromUnit(c))]),
            [['g', fn([own('x', string), own('y', string)], f64, float(length(concat(get('x'), get('y')))))]])),
        { f: ([, flag]) => flag === true ? 0 : 2 },
        {}),
    leavingFirst: () => run(
        owned(module_([['c', u(16)], ['b', bool]], f64, loop('L', [['x', string, fromUnit(c)], ['y', string, if_(b, return_(zero), fromUnit(c))]], (x, y) =>
            float(length(concat(x, y)))))),
        { f: ([, flag]) => flag === true ? 0 : 2 },
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
    // A throw gives the host its value and leaves nothing behind: what the function owns is dropped before it. A trap where
    // the L0 view throws is told apart from a throw. Only `viaCallee` abandons a value, the string that it owns while the
    // function that it calls throws, which the host recovers.
    throws: () => run(owned(throws), throwing, {}, ['viaCallee']),
    // A throw of another value, a twin that traps where the module throws, and one that throws where the module traps
    // disagree.
    throwsOther: () => {
        assert(disagrees('ownedLength', () => run(owned(throws), { ...throwing, ownedLength: ([v]) => BigInt(textOr(v, 'not a number').length) }, {}, ['viaCallee'])))
        assert(disagrees('checked', () => run(owned(throws), { ...throwing, checked: ([v]) => typeof held(v) === 'string' ? BigInt(text(v).length) : trap('not a string') }, {}, ['viaCallee'])))
        /** @type {_Twin} */
        const thrownPast = ([s, i]) => {
            if (Number(i) >= text(s).length) { throw 'past the end' }
            return BigInt(unit(text(s), Number(i)))
        }
        assert(disagrees('unitOf', () => run(owned(throws), { ...throwing, unitOf: thrownPast }, {}, ['viaCallee'])))
    },
    // A throw that abandons a value is refused, unless the function may: one that a callee's throw leaves, and one that
    // a module writes in the owned stage without its drop.
    abandons: () => {
        assert(refusedFor('viaCallee', 'a throw abandoned', () => run(owned(throws), throwing, {})))
        /** @type {Module} */
        const undropped = {
            imports: l0,
            functions: [['f', fn([own('v', any)], u(31), match(get('v'), [
                [['string'], 's', let_('n', length(get('s')), n => let_('d', call('Any', 'drop', [get('v')]), () => n))],
                [null, null, throw_(call('Any', 'dup', [lit(string, 'not a string')]))],
            ]))]],
            exports: ['f'],
        }
        /** @type {StringMap<_Twin>} */
        const twin = { f: ([v]) => BigInt(textOr(v, 'not a string').length) }
        assert(refusedFor('f', 'a throw abandoned', () => run(undropped, twin, {})))
        run(undropped, twin, {}, ['f'])
    },
    // A function that the checker says cannot fail never fails: an interface that hides that String's unit may fail is caught.
    cannotFail: () => {
        /** @type {Module} */
        const hiding = {
            imports: l0.map(([k, i]) => [k, k !== 'String' ? i : { ...i, functions: i.functions.map(([f, { params, result }]) => [f, { params, result }]) }]),
            functions: [['unitOf', fn([['s', string], ['i', u(31)]], u(16), call('String', 'unit', [get('s'), get('i')]))]],
            exports: ['unitOf'],
        }
        assert(refusedFor('unitOf', 'cannot fail, and it did', () => run(hiding, throwing, {})))
    },
    // Without the pass, nothing drops the string that from_unit makes; with it, no cell is left.
    leaks: () => {
        const m = module_([['c', u(16)]], u(31), let_('s', fromUnit(c), s => length(s)))
        assertEq(leftAfter(assertOk(checkPlain(m)), [0x61]), '0:1')
        assertEq(leftAfter(assertOk(check(owned(m))), [0x61]), '')
    },
}
