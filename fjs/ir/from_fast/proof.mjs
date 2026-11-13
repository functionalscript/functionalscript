/**
 * The host proof of the lowering: [`sample.f.js`](./sample.f.js), read as
 * text, lowered from its normalized FAST, checked and emitted, runs on the
 * host's WebAssembly engine against the functions of that module
 * themselves, on the edges of their parameters' types, as
 * [`testlib.mjs`](../wasm/testlib.mjs) runs a module. The IR that the
 * lowering makes of it is written out below, to read beside the original.
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Module } from '../types.ts'
 * @import { _Twin, _Value } from '../wasm/private.ts'
 */

import { readFileSync } from 'node:fs'
import { assertEq, assertOk } from '../../asserts/module.f.js'
import { print } from '../print/module.f.mjs'
import { edges, product, run } from '../wasm/testlib.mjs'
import { lower } from './module.f.mjs'
import * as sample from './sample.f.js'
import { fastOf, signatures } from './testlib.f.mjs'

/** The module that the lowering makes of the sample's text. @type {() => Module} */
const lowered = () => assertOk(lower(signatures)(assertOk(fastOf(readFileSync(new URL('./sample.f.js', import.meta.url), 'utf8')))))

/** Each function of the sample, taking its arguments as a list. @type {StringMap<_Twin>} */
const originals = Object.fromEntries(Object.entries(sample).map(([name, f]) => {
    const g = /** @type {(...xs: readonly _Value[]) => _Value} */ (/** @type {unknown} */ (f))
    return [name, /** @type {_Twin} */ (xs => g(...xs))]
}))

/** `pow` recurses `k` times, so the edges of `f64` do not suit `k`. @type {StringMap<readonly (readonly _Value[])[]>} */
const inputs = { pow: product([edges(['f64']), [0, -0, 1, 2, 10, -1, 0.5, 3.5]]) }

export const proof = {
    ir: () => assertEq(print(lowered()), [
        'fn atLeast(a: f64, b: f64) -> bool =',
        '    le(b, a)',
        '',
        'fn average(a: u(32), b: u(32)) -> f64 =',
        '    div(float(add(a, b)), 2.0)',
        '',
        'fn both(a: bool, b: bool) -> bool =',
        '    if a then b else a',
        '',
        'fn clamp(x: i(32), lo: i(32), hi: i(32)) -> i(32) =',
        '    if lt(x, lo) then lo else if lt(hi, x) then hi else x',
        '',
        'fn delta(a: u(16), b: u(16)) -> i(17) =',
        '    sub(a, b)',
        '',
        'fn differ(a: bool, b: bool) -> bool =',
        '    if a',
        '    then',
        '        if b then false else true',
        '    else',
        '        b',
        '',
        'fn distance(x: f64, y: f64, p: f64, q: f64) -> f64 =',
        '    hypot(sub(p, x), sub(q, y))',
        '',
        'fn early(a: f64, b: f64) -> f64 =',
        '    if lt(a, 0.0)',
        '    then',
        '        0.0',
        '    else',
        '        sub(',
        '            let #0 = mul(a, b)',
        '            add(#0, #0),',
        '            a',
        '        )',
        '',
        'fn either(a: bool, b: bool) -> bool =',
        '    if a then a else b',
        '',
        'fn greater(a: f64, b: f64) -> bool =',
        '    lt(b, a)',
        '',
        'fn hypot(a: f64, b: f64) -> f64 =',
        '    sqrt(add(mul(a, a), mul(b, b)))',
        '',
        'fn lessU64(a: u(64), b: u(64)) -> bool =',
        '    lt(a, b)',
        '',
        'fn magnitude(x: f64) -> f64 =',
        '    abs(neg(x))',
        '',
        'fn max(a: f64, b: f64) -> f64 =',
        '    if lt(a, b) then b else a',
        '',
        'fn negate(x: f64) -> f64 =',
        '    neg(x)',
        '',
        'fn notEqual(a: i(64), b: i(64)) -> bool =',
        '    if eq(a, b) then false else true',
        '',
        'fn opposite(x: i(32)) -> int(-2147483647, 2147483648) =',
        '    sub(0, x)',
        '',
        'fn pow(x: f64, k: f64) -> f64 =',
        '    if le(k, 0.0) then 1.0 else mul(x, pow(x, sub(k, 1.0)))',
        '',
        'fn product(a: u(32), b: u(32)) -> u(64) =',
        '    mul(a, b)',
        '',
        'fn safeDiv(a: f64, b: f64) -> f64 =',
        '    if eq(b, 0.0) then 0.0 else div(a, b)',
        '',
        'fn same(a: i(32), b: u(32)) -> bool =',
        '    eq(a, b)',
        '',
        'fn sameBool(a: bool, b: bool) -> bool =',
        '    if a then b else if b then false else true',
        '',
        'fn sign(x: i(32)) -> int(-1, 1) =',
        '    if lt(x, 0) then -1 else if eq(x, 0) then 0 else 1',
        '',
        'fn square(a: f64, b: f64) -> f64 =',
        '    let #0 = add(a, b)',
        '    mul(#0, #0)',
        '',
        'fn sum(a: u(32), b: u(32)) -> u(33) =',
        '    add(a, b)',
        '',
        'fn xor(a: bool, b: bool) -> bool =',
        '    if a',
        '    then',
        '        if b then false else true',
        '    else',
        '        b',
        '',
        'export atLeast, average, both, clamp, delta, differ, distance, early, either, greater, hypot, lessU64, magnitude, max, negate, notEqual, opposite, pow, product, safeDiv, same, sameBool, sign, square, sum, xor',
        '',
    ].join('\n')),
    run: () => run(lowered(), originals, inputs),
}
