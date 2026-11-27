/**
 * Emits the IR / direct-to-WASM modules the sort and Collatz pages load:
 * lowers each `ir.f.js`, writes `<name>.ir.wasm` under `nanvm/demos/wasm/`,
 * and copies `nanvm_l0_wasm.wasm` beside them. Invoked from
 * `nanvm/demos/gen.build.sh` after NaNVM L0 is built.
 *
 * Usage (repository root):
 *   node ./fjs/nanvm/demos/ir/emit.mjs
 */

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { here, programBytes } from './lower.mjs'
import { irFileName, irPrograms, l0FileName } from './module.f.js'

const outDir = here('nanvm/demos/wasm/')
mkdirSync(outDir, { recursive: true })

for (const name of irPrograms) {
    const bytes = programBytes(name)
    const dest = new URL(irFileName(name), outDir)
    writeFileSync(dest, bytes)
    console.log(`wrote ${dest.pathname} (${bytes.length} bytes)`)
}

const l0Src = here(`target/wasm32-unknown-unknown/release/${l0FileName}`)
const l0Dest = new URL(l0FileName, outDir)
copyFileSync(l0Src, l0Dest)
console.log(`copied ${l0Dest.pathname}`)
