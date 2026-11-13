/**
 * The host proof of the lowering: [`sample.f.js`](./sample.f.js), read as
 * text, lowered from its normalized FAST, checked and emitted, runs on the
 * host's WebAssembly engine against the functions of that module
 * themselves, on the edges of their parameters' types, as
 * [`testlib.mjs`](../wasm/testlib.mjs) runs a module. So does L1's
 * `toBoolean`, lowered from the text of
 * [L1](../../wasm/runtime/l1/module.f.js) over the L0 view, against L1's own,
 * on values of every kind. The IR that the lowering makes of each is
 * written out below, to read beside the original.
 *
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { Module } from '../types.ts'
 * @import { _Twin, _Value } from '../wasm/types.ts'
 */

import { readFileSync } from 'node:fs'
import { assertEq, assertOk } from '../../asserts/module.f.js'
import { toBoolean } from '../../wasm/runtime/l1/module.f.js'
import { print } from '../print/module.f.mjs'
import { edges, held, product, run } from '../wasm/testlib.mjs'
import { lower } from './module.f.mjs'
import * as sample from './sample.f.js'
import { l1, signatures, sourceOf, view } from './testlib.f.mjs'

/** The module that the lowering makes of a module's text, read from `url`, for the functions that `table` names. @type {(url: URL, table: Parameters<typeof lower>[0], v?: string | null) => Module} */
const fromText = (url, table, v = null) => {
    const { fast, imports } = assertOk(sourceOf(readFileSync(url, 'utf8')))
    return assertOk(lower(table, v)(fast, imports))
}

/** The module that the lowering makes of the sample's text. @type {() => Module} */
const lowered = () => fromText(new URL('./sample.f.js', import.meta.url), signatures)

/** The module that the lowering makes of L1's text, over the L0 view. @type {() => Module} */
const fromL1 = () => fromText(new URL('../../wasm/runtime/l1/module.f.js', import.meta.url), l1, view)

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
    l1: () => assertEq(print(fromL1()), [
        'import Any from fjs:l0',
        '    type any = undefined | null | boolean | number | string | bigint | array | object | function',
        '        kind: kind, carrier: i64',
        '    fn kind(v: any) -> int(0, 8)',
        '    fn to_f64(v: any.only(number)) -> f64c',
        '    fn to_bool(v: any.only(boolean)) -> bool',
        '',
        'import String from fjs:l0',
        '    fn length(s: any.only(string)) -> u(31)',
        '',
        'import BigInt from fjs:l0',
        '    fn length(b: any.only(bigint)) -> u(31)',
        '',
        'import Containers from fjs:l0',
        '    fn length(c: any.only(array, object)) -> u(31)',
        '',
        'import Functions from fjs:l0',
        '    fn length(f: any.only(function)) -> u(31)',
        '',
        'fn toBoolean(v: any) -> bool =',
        '    let #0 = float(Any.kind(v))',
        '    if eq(#0, 2.0)',
        '    then',
        '        match v',
        '          boolean as v.boolean =>',
        '            Any.to_bool(v.boolean)',
        '          else =>',
        "            trap('not boolean')",
        '    else',
        '        if eq(#0, 3.0)',
        '        then',
        '            let #1 =',
        '                match v',
        '                  number as v.number =>',
        '                    Any.to_f64(v.number)',
        '                  else =>',
        "                    trap('not number')",
        '            let #2 = eq(#1, #1)',
        '            if #2',
        '            then',
        '                if eq(#1, 0.0) then false else true',
        '            else',
        '                #2',
        '        else',
        '            if',
        '                let #1 = eq(#0, 4.0)',
        '                if #1 then #1 else eq(#0, 5.0)',
        '            then',
        '                if',
        '                    eq(',
        '                        float(',
        '                            match v',
        '                              string as v.string =>',
        '                                String.length(v.string)',
        '                              bigint as v.bigint =>',
        '                                BigInt.length(v.bigint)',
        '                              array | object as v.containers =>',
        '                                Containers.length(v.containers)',
        '                              function as v.functions =>',
        '                                Functions.length(v.functions)',
        '                              undefined | null | boolean | number =>',
        "                                trap('no length')",
        '                        ),',
        '                        0.0',
        '                    )',
        '                then',
        '                    false',
        '                else',
        '                    true',
        '            else',
        '                let #1 = eq(#0, 6.0)',
        '                let #2 = if #1 then #1 else eq(#0, 7.0)',
        '                if #2 then #2 else eq(#0, 8.0)',
        '',
        'export toBoolean',
        '',
    ].join('\n')),
    l1Run: () => run(fromL1(), { toBoolean: ([v]) => toBoolean(held(v)) }, {}),
}
