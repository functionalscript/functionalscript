/**
 * Host proofs of the counting host: how it counts, and hand-written IR of
 * the owned stage run on it, which leaves every cell as it found it. A
 * WebAssembly import is the boundary: a FunctionalScript proof can neither
 * instantiate a module nor hold the cells that the imports count.
 *
 * Prefer `node --test` for this file
 * ([fjs/AGENTS.md §1.6](../../../../AGENTS.md#16-use-host-proofs-only-for-documented-host-contracts)).
 *
 * @import { Param, Term, Type } from '../../../types.ts'
 * @import { Counting } from '../types.ts'
 */

import { assert, assertEq, assertOk } from '../../../../asserts/module.f.js'
import { write } from '../../../../media/wasm/binary/write/module.f.js'
import { check } from '../../../check/module.f.js'
import { add, bool, call, f64, float, fn, get, if_, let_, lit, loop, lt, match, next, only, own, return_, u, unit } from '../../../module.f.js'
import { emit } from '../../../wasm/module.f.js'
import { any, l0 } from '../../module.f.js'
import { counting } from './module.mjs'

const string = only(any, 'string')

/** The cells that are alive, as text: each handle and its count. @type {(h: Counting) => string} */
const cells = h => h.live().map(([k, count]) => `${k}:${count}`).join()

/**
 * A function `f` over L0, checked, emitted and instantiated on a counting
 * host whose first cells are `values`.
 *
 * @type {(params: readonly Param[], result: Type, body: Term, values: readonly unknown[]) => { readonly f: Function, readonly h: Counting }}
 */
const load = (params, result, body, values) => {
    const checked = assertOk(check({ imports: l0, functions: [['f', fn(params, result, body)]], exports: ['f'] }))
    const bytes = new Uint8Array(write(emit(checked)))
    assert(WebAssembly.validate(bytes))
    const h = counting(values)
    const { exports } = new WebAssembly.Instance(new WebAssembly.Module(bytes), { 'fjs:l0': h.imports })
    const f = exports.f
    assert(typeof f === 'function')
    return { f, h }
}

/** @type {(a: Term, b: Term) => Term} */
const concat = (a, b) => call('String', 'concat', [a, b])

/** @type {(v: Term) => Term} */
const drop = v => call('Any', 'drop', [v])

const a = get('a')
const one = lit(f64, 1)
const zero = lit(f64, 0)

export const proof = {
    // `dup` adds one to a cell's count, `drop` takes one away and frees the cell at zero, and a made value is a new cell.
    counts: () => {
        const h = counting(['a'])
        assertEq(cells(h), '0:1')
        assertEq(h.imports.dup(0n), 0n)
        assertEq(cells(h), '0:2')
        h.imports.drop(0n)
        assertEq(cells(h), '0:1')
        const s = h.imports.from_unit(0x62)
        const t = h.imports.concat(0n, s)
        assertEq(`${h.read(s)} ${h.read(t)} ${h.imports.length(t)} ${h.imports.kind(t)}`, 'b ab 2 4')
        assertEq(cells(h), '0:1,1:1,2:1')
        h.imports.drop(0n)
        h.imports.drop(s)
        assertEq(cells(h), '2:1')
        // substring and item make a cell too, an item of its own beside the array's
        const u = h.imports.substring(t, 1, 2)
        assertEq(`${h.read(u)} ${cells(h)}`, 'b 2:1,3:1')
        const c = counting([[t]])
        const x = c.imports.item(0n, 0)
        assertEq(`${c.read(x)} ${cells(c)}`, `${t} 0:1,1:1`)
    },
    // A handle of no cell throws, and so does one whose cell a drop freed.
    throw: {
        none: () => { counting([]).read(0n) },
        freed: () => {
            const h = counting(['x'])
            h.imports.drop(0n)
            h.imports.dup(0n)
        },
    },
    // concat of a borrowed string answers an owned one, which the caller drops.
    concat: () => {
        const { f, h } = load([['a', string]], string, concat(a, a), ['ab'])
        const r = f(0n)
        assert(typeof r === 'bigint')
        assertEq(`${h.read(r)} ${cells(h)}`, `abab 0:1,${r}:1`)
        h.imports.drop(r)
        assertEq(cells(h), '0:1')
    },
    // A function that makes a string and drops it leaves no cell.
    fromUnit: () => {
        const { f, h } = load([['c', u(16)]], unit, let_('s', call('String', 'from_unit', [get('c')]), s => drop(s)), [])
        f(0x61)
        assertEq(cells(h), '')
    },
    // An own parameter is the callee's to drop, and a dup is the caller's.
    own: () => {
        const { f, h } = load([own('v', any)], unit, drop(get('v')), ['x', 'y'])
        f(1n)
        assertEq(cells(h), '0:1')
    },
    dup: () => {
        const { f, h } = load([['v', any]], any, call('Any', 'dup', [get('v')]), ['x'])
        assertEq(`${f(0n)} ${cells(h)}`, '0 0:2')
    },
    // A match lends its operand: the arm reads the string, then drops the owned value.
    lends: () => {
        const { f, h } = load([own('v', any)], u(31), match(get('v'), [
            [['string'], 'v.s', let_('n', call('String', 'length', [get('v.s')]), n => let_('d', drop(get('v')), () => n))],
            [null, null, let_('d', drop(get('v')), () => lit(u(31), 0n))],
        ]), ['abc', 1])
        assertEq(`${f(0n)} ${f(1n)} ${cells(h)}`, '3 0 ')
    },
    // A loop that owns its string doubles it k times, dropping each old one.
    loop: () => {
        const { f, h } = load([['a', string], ['k', f64]], string, loop('L', [['s', string, concat(a, a)], ['i', f64, one]], (s, i) =>
            if_(lt(i, get('k')), let_('t', concat(s, s), t => let_('d', drop(s), () => next('L', [['s', t], ['i', add(i, one)]]))), s)), ['ab'])
        const r = f(0n, 3)
        assert(typeof r === 'bigint')
        assertEq(`${h.read(r)} ${h.live().length}`, 'abababababababab 2')
        h.imports.drop(r)
        assertEq(cells(h), '0:1')
    },
    // A path that leaves the function early drops what it owns first.
    early: () => {
        const { f, h } = load([['a', string], ['b', bool]], f64, let_('t', concat(a, a), t =>
            let_('x', if_(get('b'), let_('d', drop(t), () => return_(zero)), one), x =>
                let_('n', float(call('String', 'length', [t])), n => let_('e', drop(t), () => add(x, n))))), ['ab'])
        assertEq(`${f(0n, 1)} ${f(0n, 0)} ${cells(h)}`, '0 5 0:1')
    },
}
