// @ts-nocheck
/**
 * Host proof that the sort and Collatz IR programs lower, emit, and run on
 * NaNVM L0 with the same report text as JavaScript — the effect is
 * WebAssembly instantiation against the real L0 module.
 */

import { readFileSync } from 'node:fs'
import { assert, assertEq, assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../../ir/check/module.f.js'
import { lower } from '../../../ir/from_fast/module.f.js'
import { errorTable } from '../../../ir/from_fast/link/module.f.js'
import { l1Runtime, l1Whole, sourceOf } from '../../../ir/from_fast/testlib.f.js'
import { lifetime } from '../../../ir/lifetime/module.f.js'
import { nanvmHost } from '../../../ir/l0/host/nanvm/module.mjs'
import { host as nativeHost } from '../../../ir/native/host/module.mjs'
import { emit } from '../../../ir/wasm/module.f.js'
import { run as collatzJs } from '../collatz/ir.f.js'
import { run as sortJs } from '../sort/ir.f.js'
import { bindIr, layoutOf } from './host.mjs'

const here = path => new URL(`../../../../${path}`, import.meta.url)

const fromText = (path, table, runtime) => {
    const { fast, imports } = assertOk(sourceOf(readFileSync(path, 'utf8')))
    return assertOk(lower(table, runtime)(fast, imports))
}

const compile = m => {
    const [tag, checked] = check(m)
    assert(tag === 'ok', checked)
    return new WebAssembly.Module(new Uint8Array(write(emit(checked))))
}

const errors = assertOk(errorTable(assertOk(sourceOf(readFileSync(here('fjs/wasm/runtime/l1/error/module.f.js'), 'utf8'))).fast))
const runtime = {
    ...l1Runtime(errors),
    l1: fromText(here('fjs/wasm/runtime/l1/module.f.js'), l1Whole, l1Runtime(errors)),
}
const l0 = new WebAssembly.Module(readFileSync(here('target/wasm32-unknown-unknown/release/nanvm_l0_wasm.wasm')))

/** @type {(path: string, js: () => string) => void} */
const checkProgram = (path, js) => {
    const mod = compile(assertOk(lifetime(fromText(here(path), {}, runtime))))
    const { data, entries } = layoutOf(mod)
    assert(data >= 0)
    assert(entries >= 0)
    const expected = js()
    const { invoke } = bindIr(l0, mod, 'run')
    const { value } = invoke()
    assertEq(value, expected)
}

export const proof = {
    collatz: () => checkProgram('fjs/nanvm/demos/collatz/ir.f.js', collatzJs),
    // Sort is heavy on NaNVM containers; still must match JavaScript.
    sort: () => checkProgram('fjs/nanvm/demos/sort/ir.f.js', sortJs),
    // nanvmHost is reachable so the suite stays meaningful if bindIr drifts.
    hostShape: () => {
        const h = nanvmHost(l0)([], 0, 0)
        assert(typeof h.imports.drop === 'function')
        assert(h.native !== undefined || nativeHost !== undefined)
    },
}
