/**
 * The one lowering of a demo's IR program to WebAssembly bytes, shared by
 * [`emit.mjs`](./emit.mjs), which writes the bytes the pages load, and
 * [`ir.test.mjs`](./ir.test.mjs), which runs them: L1's text and error
 * table lowered as the runtime, then the program's `ir.f.js` lowered,
 * linked, given lifetimes, checked and emitted.
 *
 * @module
 *
 * @import { Module } from '../../../ir/types.ts'
 */

import { readFileSync } from 'node:fs'
import { assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../../ir/check/module.f.js'
import { lower } from '../../../ir/from_fast/module.f.js'
import { errorTable } from '../../../ir/from_fast/link/module.f.js'
import { l1Runtime, l1Whole, sourceOf } from '../../../ir/from_fast/testlib.f.js'
import { lifetime } from '../../../ir/lifetime/module.f.js'
import { emit } from '../../../ir/wasm/module.f.js'

/** A path from the repository's root, as a URL. @type {(path: string) => URL} */
export const here = path => new URL(`../../../../${path}`, import.meta.url)

/** The lowering's runtime, as `lower` takes it. @typedef {NonNullable<Parameters<typeof lower>[1]>} Runtime */

/** The IR module of a file's text. @type {(path: URL, table: Parameters<typeof lower>[0], runtime: Runtime) => Module} */
const fromText = (path, table, runtime) => {
    const { fast, imports } = assertOk(sourceOf(readFileSync(path, 'utf8')))
    return assertOk(lower(table, runtime)(fast, imports))
}

/** L1 lowered from its text, with its error table, as the programs' runtime. @type {() => Runtime} */
const runtimeOf = () => {
    const errors = assertOk(errorTable(assertOk(sourceOf(readFileSync(here('fjs/wasm/runtime/l1/error/module.f.js'), 'utf8'))).fast))
    return { ...l1Runtime(errors), l1: fromText(here('fjs/wasm/runtime/l1/module.f.js'), l1Whole, l1Runtime(errors)) }
}

/**
 * The WebAssembly bytes of the demo `name`'s `ir.f.js`. A module that check
 * refuses throws with check's reason.
 *
 * @type {(name: string) => Uint8Array<ArrayBuffer>}
 */
export const programBytes = name => {
    const m = assertOk(lifetime(fromText(here(`fjs/nanvm/demos/${name}/ir.f.js`), {}, runtimeOf())))
    const [tag, checked] = check(m)
    if (tag !== 'ok') { throw new Error(String(checked)) }
    return new Uint8Array(write(emit(checked)))
}
