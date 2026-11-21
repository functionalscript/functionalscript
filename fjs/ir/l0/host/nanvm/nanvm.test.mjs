/**
 * The emitter's host proofs again, each module run on NaNVM's `.wasm`
 * through the [NaNVM host](./module.mjs) in place of the counting host
 * ([slice 12](../../../todo/slices.md)): the WebAssembly proofs, the
 * lifetime pass's, the FAST lowering's, and the random programs. A proof
 * that runs no module runs once more on the counting host, as it is.
 * L1's native rows run in NaNVM's Rust too, and are compared with
 * JavaScript on random floats, texts and bigints
 * ([slice 12c](../../../todo/slices.md)).
 *
 * NaNVM's `.wasm` is built first, by
 *
 * ```sh
 * cargo build -p nanvm-l0-wasm --release --target wasm32-unknown-unknown
 * ```
 *
 * and this file fails where it is missing: it is named outside the host
 * proofs that `js-only.mjs` finds, so that a run without Rust still passes
 * those, and CI runs it after the build
 * (`node --test ./fjs/ir/l0/host/nanvm/nanvm.test.mjs`).
 *
 * @module
 */

import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { proof as fromFast } from '../../../from_fast/proof.mjs'
import { proof as random } from '../../../from_fast/random/proof.mjs'
import { proof as lifetime } from '../../../lifetime/proof.mjs'
import { onHost } from '../../../wasm/testlib.mjs'
import { proof as wasm } from '../../../wasm/proof.mjs'
import { nanvmHost } from './module.mjs'

/** Where cargo writes NaNVM's `.wasm`, from the repository's root. */
const path = new URL('../../../../../target/wasm32-unknown-unknown/release/nanvm_l0_wasm.wasm', import.meta.url)

const host = nanvmHost(new WebAssembly.Module(readFileSync(path)))

/** @type {readonly (readonly [string, Readonly<Record<string, unknown>>])[]} */
const suites = [['wasm', wasm], ['lifetime', lifetime], ['from_fast', fromFast], ['random', random]]

let ran = 0
for (const [name, proofs] of suites) {
    for (const [k, f] of Object.entries(proofs)) {
        if (typeof f !== 'function') { continue }
        test(`${name}.${k}`, () => {
            ran += onHost(host, () => { f() })
        })
    }
}

/** A deterministic generator of 32-bit words: xorshift32 from `seed`. @type {(seed: number) => () => number} */
const words = seed => {
    let x = seed >>> 0
    return () => {
        x ^= x << 13
        x >>>= 0
        x ^= x >>> 17
        x ^= x << 5
        x >>>= 0
        return x
    }
}

/** The floats whose bits a generator gives, beside the edges of every kind. @type {(next: () => number, n: number) => readonly number[]} */
const floats = (next, n) => {
    const view = new DataView(new ArrayBuffer(8))
    const random = Array.from({ length: n }, () => {
        view.setUint32(0, next())
        view.setUint32(4, next())
        return view.getFloat64(0)
    })
    const small = Array.from({ length: n }, () => (next() - 0x8000_0000) / 2 ** (next() % 40))
    return [0, -0, 1, -1, 0.1, 0.1 + 0.2, 1e21, 1e-7, 123456789012345680000, 5e-324, Number.MAX_VALUE, NaN, Infinity, -Infinity, ...random, ...small]
}

/** Texts that `Number` reads, and many that it does not. @type {(next: () => number, n: number) => readonly string[]} */
const texts = (next, n) => {
    const parts = ['', ' ', '\t', '\n', '\u00a0', '\ufeff', '+', '-', '0', '1', '9', '.', 'e', 'E', 'x', '0x', '0b', '0o', 'f', 'Infinity', 'NaN', '_', '1e400', '\u0663']
    const random = Array.from({ length: n }, () =>
        Array.from({ length: next() % 6 }, () => parts[next() % parts.length]).join(''))
    return ['', ' 12 ', '0x1F', '0b101', '0o17', '1e3', '.5', '5.', '-Infinity', '+0', '-0', '1_000', '12a', ...random]
}

/** Calls a native row of a fresh NaNVM host on JavaScript values, and reads its answer. @type {(name: string, xs: readonly unknown[]) => unknown} */
const native = (name, xs) => {
    const h = host([])
    const f = /** @type {Function} */ (/** @type {Record<string, unknown>} */ (h.native)[name])
    const args = xs.map(x => typeof x === 'number' && name !== 'stringToNumber' && name !== 'bigintLess' ? x : h.own(x))
    const r = f(...args)
    return typeof r === 'bigint' ? h.read(r) : r
}

test('numberToString and stringToNumber agree with JavaScript', () => {
    const next = words(0x12c_5eed)
    for (const x of floats(next, 2000)) {
        const got = native('numberToString', [x])
        if (got !== String(x)) { throw ['numberToString', x, got, String(x)] }
    }
    for (const t of texts(next, 2000)) {
        const got = native('stringToNumber', [t])
        if (!Object.is(got, Number(t))) { throw ['stringToNumber', t, got, Number(t)] }
    }
})

test('the bigint rows agree with JavaScript', () => {
    const next = words(0xb16_1e55)
    /** @type {() => bigint} */
    const big = () => {
        const w = Array.from({ length: next() % 5 }, () => BigInt(next()))
        const m = w.reduce((a, x) => (a << 32n) + x, 0n)
        return next() % 2 === 0 ? m : -m
    }
    /** @type {readonly (readonly [string, (a: bigint, b: bigint) => unknown])[]} */
    const rows = [
        ['bigintAdd', (a, b) => a + b],
        ['bigintSubtract', (a, b) => a - b],
        ['bigintMultiply', (a, b) => a * b],
        ['bigintDivide', (a, b) => a / b],
        ['bigintEquals', (a, b) => a === b ? 1 : 0],
        ['bigintLess', (a, b) => a < b ? 1 : 0],
    ]
    for (let k = 0; k < 500; k += 1) {
        const [a, b] = [big(), big()]
        for (const [name, f] of rows) {
            if (name === 'bigintDivide' && b === 0n) { continue }
            const got = native(name, [a, b])
            if (got !== f(a, b)) { throw [name, a, b, got, f(a, b)] }
        }
        if (native('bigintNegate', [a]) !== -a) { throw ['bigintNegate', a] }
        if (native('bigintToString', [a]) !== String(a)) { throw ['bigintToString', a] }
        const x = [NaN, Infinity, -Infinity, 0][k % 8] ?? floats(next, 1)[14] ?? 0
        const mixed = native('bigintLess', [a, x])
        if (mixed !== (a < x ? 1 : a >= x ? 0 : -1)) { throw ['bigintLess', a, x, mixed] }
    }
})

test('NaNVM ran modules', () => {
    if (ran === 0) { throw 'no module ran on NaNVM' }
})
