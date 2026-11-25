// @ts-nocheck
/**
 * Emits the IR / direct-to-WASM modules the sort and Collatz pages load:
 * lowers each `ir.f.js`, writes `<name>.ir.wasm` under `nanvm/demos/wasm/`,
 * and copies `nanvm_l0_wasm.wasm` beside them. Invoked from
 * `nanvm/demos/gen.build.sh` after NaNVM L0 is built.
 *
 * Usage (repository root):
 *   node ./fjs/nanvm/demos/ir/emit.mjs
 */

import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { assertOk } from '../../../asserts/module.f.js'
import { write } from '../../../media/wasm/binary/write/module.f.js'
import { check } from '../../../ir/check/module.f.js'
import { lower } from '../../../ir/from_fast/module.f.js'
import { errorTable } from '../../../ir/from_fast/link/module.f.js'
import { l1Runtime, l1Whole, sourceOf } from '../../../ir/from_fast/testlib.f.js'
import { lifetime } from '../../../ir/lifetime/module.f.js'
import { emit } from '../../../ir/wasm/module.f.js'
import { irFileName, irPrograms, l0FileName } from './module.f.js'

const root = new URL('../../../../', import.meta.url)
const here = path => new URL(path, root)

const fromText = (path, table, runtime) => {
    const { fast, imports } = assertOk(sourceOf(readFileSync(path, 'utf8')))
    return assertOk(lower(table, runtime)(fast, imports))
}

const compileBytes = m => {
    const [tag, checked] = check(m)
    if (tag !== 'ok') { throw new Error(String(checked)) }
    return new Uint8Array(write(emit(checked)))
}

const errors = assertOk(errorTable(assertOk(sourceOf(readFileSync(here('fjs/wasm/runtime/l1/error/module.f.js'), 'utf8'))).fast))
const runtime = {
    ...l1Runtime(errors),
    l1: fromText(here('fjs/wasm/runtime/l1/module.f.js'), l1Whole, l1Runtime(errors)),
}

const outDir = here('nanvm/demos/wasm/')
mkdirSync(outDir, { recursive: true })

for (const name of irPrograms) {
    const bytes = compileBytes(assertOk(lifetime(fromText(here(`fjs/nanvm/demos/${name}/ir.f.js`), {}, runtime))))
    const dest = new URL(irFileName(name), outDir)
    writeFileSync(dest, bytes)
    console.log(`wrote ${dest.pathname} (${bytes.length} bytes)`)
}

const l0Src = here(`target/wasm32-unknown-unknown/release/${l0FileName}`)
const l0Dest = new URL(l0FileName, outDir)
copyFileSync(l0Src, l0Dest)
console.log(`copied ${l0Dest.pathname}`)
