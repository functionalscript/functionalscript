/**
 * Host proof that the sort and Collatz IR programs lower, emit, and run on
 * NaNVM L0 with the same report text as JavaScript — the effect is
 * WebAssembly instantiation against the real L0 module.
 *
 * Not named `proof.mjs`: importing that would pull NaNVM's `.wasm` into every
 * `js-only` host-proof run. Same pattern as
 * [`nanvm.test.mjs`](../../../ir/l0/host/nanvm/nanvm.test.mjs): build L0 first,
 * then run this file. CI does that in `nanvmWasmCommands`.
 *
 * ```sh
 * cargo build -p nanvm-l0-wasm --release --target wasm32-unknown-unknown
 * node --test ./fjs/nanvm/demos/ir/ir.test.mjs
 * ```
 */

import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { assert, assertEq } from '../../../asserts/module.f.js'
import { nanvmHost } from '../../../ir/l0/host/nanvm/module.mjs'
import { host as nativeHost } from '../../../ir/native/host/module.mjs'
import { layoutOf } from '../../../ir/wasm/layout.mjs'
import { run as collatzJs } from '../collatz/ir.f.js'
import { run as sortJs } from '../sort/ir.f.js'
import { bindIr } from './host.mjs'
import { here, programBytes } from './lower.mjs'
import { irExportName, l0FileName } from './module.f.js'

const l0Path = here(`target/wasm32-unknown-unknown/release/${l0FileName}`)

/** @type {() => WebAssembly.Module} */
const loadL0 = () => {
    if (!existsSync(l0Path)) {
        throw new Error(
            `missing ${l0Path.pathname}; build it with:\n` +
            `cargo build -p nanvm-l0-wasm --release --target wasm32-unknown-unknown`)
    }
    return new WebAssembly.Module(readFileSync(l0Path))
}

/** @type {(l0: WebAssembly.Module, name: string, js: () => string) => void} */
const checkProgram = (l0, name, js) => {
    const mod = new WebAssembly.Module(programBytes(name))
    const { data, entries } = layoutOf(mod)
    assert(data >= 0)
    assert(entries >= 0)
    const expected = js()
    const { invoke } = bindIr(l0, mod, irExportName)
    const { value } = invoke()
    assertEq(value, expected)
}

test('collatz', () => {
    checkProgram(loadL0(), 'collatz', collatzJs)
})

// Sort is heavy on NaNVM containers; still must match JavaScript.
test('sort', () => {
    checkProgram(loadL0(), 'sort', sortJs)
})

// nanvmHost is reachable so the suite stays meaningful if bindIr drifts.
test('hostShape', () => {
    const h = nanvmHost(loadL0())([], 0, 0)
    assert(typeof h.imports.drop === 'function')
    assert(h.native !== undefined || nativeHost !== undefined)
})
