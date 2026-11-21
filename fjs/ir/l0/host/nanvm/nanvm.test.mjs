/**
 * The emitter's host proofs again, each module run on NaNVM's `.wasm`
 * through the [NaNVM host](./module.mjs) in place of the counting host
 * ([slice 12](../../../todo/slices.md)): the WebAssembly proofs, the
 * lifetime pass's, the FAST lowering's, and the random programs. A proof
 * that runs no module runs once more on the counting host, as it is.
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

test('NaNVM ran modules', () => {
    if (ran === 0) { throw 'no module ran on NaNVM' }
})
